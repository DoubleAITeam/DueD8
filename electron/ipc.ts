// src/main/ipc.ts
import { BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { z } from 'zod';
import { getDb } from './db';
import { clearToken, fetchCanvasJson, getToken, setToken, validateToken } from './canvasService';
import type { CanvasGetPayload } from './canvasService';
import type { IpcResult } from '../src/shared/ipc';
import { mainError, mainLog } from './logger';
import {
  processAssignmentUploads,
  processRemoteAttachments,
  type ProcessedFile
} from './fileProcessing';
import { getAssignmentExportInfo, savePdfPath } from './assignmentExports';
import { createAssignmentGoogleDoc } from './googleDocs';
import { renderPdfFromHtml, savePdfToPath } from './pdf';
import { checkAndConsumeTokens } from './tokenUsage';
import { featureFlags } from '../src/config/featureFlags';
import { MAX_TOKENS_PER_24H, MAX_TOKENS_PER_ASSIGNMENT } from '../src/config/tokens';

ipcMain.handle('ping', () => 'pong');

const StudentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  county: z.enum(['Fairfax', 'Sci-Tech'])
});

const success = <T>(data: T): IpcResult<T> => ({ ok: true, data });
const failure = (error: string, status?: number): IpcResult<never> =>
  status === undefined ? { ok: false, error } : { ok: false, error, status };

const AssignmentIdSchema = z.object({ assignmentId: z.number().int().positive() });
const TokenUsageSchema = z.object({
  userId: z.string().min(1),
  assignmentId: z.number().int().positive(),
  requestedTokens: z.number().int().nonnegative()
});
const GoogleDocRequestSchema = z.object({
  assignmentId: z.number().int().positive(),
  title: z.string().optional(),
  content: z.string().min(1)
});
const PdfExportSchema = z.object({
  assignmentId: z.number().int().positive(),
  html: z.string().min(1),
  courseCode: z.string().optional(),
  assignmentName: z.string().optional()
});

function sanitizeCourseCode(courseCode?: string | null) {
  if (!courseCode) {
    return 'Course';
  }
  const cleaned = courseCode.replace(/[^a-zA-Z0-9]+/g, '');
  return cleaned.length ? cleaned : 'Course';
}

function slugifyAssignment(name?: string | null) {
  if (!name) {
    return 'assignment';
  }
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  return slug.length ? slug : 'assignment';
}

function formatDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

ipcMain.handle('canvas:setToken', async (_event, token: string): Promise<IpcResult<null>> => {
  try {
    await setToken(token);
    return success(null);
  } catch (error) {
    mainError('canvas:setToken failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to save token');
  }
});

ipcMain.handle('canvas:getToken', async (): Promise<IpcResult<string | null>> => {
  try {
    const token = await getToken();
    mainLog('canvas:getToken resolved with token present:', Boolean(token));
    return success(token);
  } catch (error) {
    mainError('canvas:getToken failed', (error as Error).message);
    return failure('Failed to read token');
  }
});

ipcMain.handle('canvas:clearToken', async (): Promise<IpcResult<null>> => {
  try {
    await clearToken();
    return success(null);
  } catch (error) {
    mainError('canvas:clearToken failed', (error as Error).message);
    return failure('Failed to clear token');
  }
});

ipcMain.handle('canvas:testToken', async (): Promise<IpcResult<{ profile?: unknown }>> => {
  try {
    const result = await validateToken();
    if (result.ok) {
      return success({ profile: result.profile });
    }
    const message =
      result.error === 'unauthorized'
        ? 'Canvas rejected the token. Please create a new one.'
        : result.error === 'missing-token'
          ? 'No Canvas token stored.'
          : 'Token validation failed';
    // PHASE 5: Surface specific error messaging so the renderer can prompt a refresh.
    return failure(message, result.status);
  } catch (error) {
    mainError('canvas:testToken unexpected error', (error as Error).message);
    return failure('Token validation error');
  }
});

ipcMain.handle('canvas:get', async (_event, payload: CanvasGetPayload): Promise<IpcResult<unknown>> => {
  try {
    if (!payload || typeof payload.path !== 'string') {
      return failure('Invalid Canvas request payload');
    }
    const result = await fetchCanvasJson(payload);
    if (result.ok) {
      return success(result.data ?? null);
    }
    return failure(result.error || 'Canvas request failed', result.status);
  } catch (error) {
    mainError('canvas:get unexpected error', (error as Error).message);
    return failure('Canvas request error');
  }
});

const FileDescriptorSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional()
});

const AssignmentInstructorContextRequest = z.object({
  assignmentId: z.number().int().positive(),
  courseId: z.number().int().positive()
});

ipcMain.handle('files:processUploads', async (_event, payload): Promise<IpcResult<ProcessedFile[]>> => {
  try {
    const files = z.array(FileDescriptorSchema).parse(payload);
    // PHASE 2: Delegate heavy lifting to Node so the renderer stays sandboxed.
    const processed = await processAssignmentUploads(files);
    return success(processed);
  } catch (error) {
    mainError('files:processUploads failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to process uploads');
  }
});

type CanvasAttachment = {
  id?: number;
  filename?: string;
  display_name?: string;
  url?: string;
  content_type?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type CanvasAssignmentDetail = {
  id: number;
  name?: string;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  attachments?: CanvasAttachment[];
};

function htmlToPlainText(html: string) {
  const withoutScripts = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ');
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ');
  const withBreaks = withoutStyles
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?p\s*[^>]*>/gi, (match) => (match.startsWith('</') ? '\n\n' : '\n'))
    .replace(/<\/?li\s*[^>]*>/gi, (match) => (match.startsWith('</') ? '\n' : '\n• '))
    .replace(/<\/?h[1-6][^>]*>/gi, '\n\n');
  const stripped = withBreaks.replace(/<[^>]+>/g, ' ');
  const decoded = stripped
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return decoded
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length)
    .join('\n');
}

ipcMain.handle(
  'assignments:fetchInstructorContext',
  async (_event, payload): Promise<IpcResult<{ entries: Array<{ fileName: string; content: string; uploadedAt: number }> }>> => {
    try {
      const { assignmentId, courseId } = AssignmentInstructorContextRequest.parse(payload);
      const result = await fetchCanvasJson({
        path: `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
        query: { 'include[]': ['submission'] }
      });
      if (!result.ok) {
        return failure(result.error || 'Failed to load assignment', result.status);
      }

      const assignment = (result.data ?? null) as CanvasAssignmentDetail | null;
      if (!assignment) {
        return success({ entries: [] });
      }

      const attachments = Array.isArray(assignment.attachments) ? assignment.attachments : [];
      const eligibleAttachments = attachments
        .map((attachment, index) => {
          const name =
            attachment.display_name || attachment.filename || `Attachment ${attachment.id ?? index + 1}`;
          const ext = name ? path.extname(name).toLowerCase() : '';
          if (!name || !attachment.url || !['.pdf', '.docx', '.txt'].includes(ext)) {
            return null;
          }
          return {
            url: attachment.url,
            name,
            type: attachment.content_type,
            createdAt: attachment.created_at,
            updatedAt: attachment.updated_at
          };
        })
        .filter((entry): entry is {
          url: string;
          name: string;
          type?: string;
          createdAt?: string | null;
          updatedAt?: string | null;
        } => Boolean(entry));

      const processedAttachments = await processRemoteAttachments(eligibleAttachments);
      const attachmentEntries = processedAttachments.map((file, index) => {
        const meta = eligibleAttachments[index];
        const timestamp = meta?.updatedAt || meta?.createdAt || null;
        const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
        return {
          fileName: file.fileName,
          content: file.content,
          uploadedAt: Number.isNaN(parsed) ? Date.now() : parsed
        };
      });

      const entries = [...attachmentEntries];
      const description = typeof assignment.description === 'string' ? assignment.description : '';
      if (description.trim().length) {
        const plain = htmlToPlainText(description);
        if (plain.length) {
          const stamp = assignment.updated_at || assignment.created_at || null;
          const parsed = stamp ? Date.parse(stamp) : Number.NaN;
          entries.unshift({
            fileName: `${assignment.name ?? 'Assignment'} description`,
            content: plain,
            uploadedAt: Number.isNaN(parsed) ? Date.now() : parsed
          });
        }
      }

      return success({ entries });
    } catch (error) {
      mainError('assignments:fetchInstructorContext failed', (error as Error).message);
      return failure((error as Error).message || 'Failed to load instructor context');
    }
  }
);

ipcMain.handle('assignments:getExportInfo', async (_event, payload) => {
  try {
    const { assignmentId } = AssignmentIdSchema.parse(payload ?? {});
    const info = getAssignmentExportInfo(assignmentId);
    return success({
      googleDocId: info.googleDocId,
      googleDocUrl: info.googleDocUrl,
      lastPdfPath: info.lastPdfPath
    });
  } catch (error) {
    mainError('assignments:getExportInfo failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to load export info');
  }
});

ipcMain.handle('assignments:createGoogleDoc', async (_event, payload) => {
  try {
    if (!featureFlags.solveExports) {
      return failure('Exports are disabled');
    }
    const { assignmentId, title, content } = GoogleDocRequestSchema.parse(payload ?? {});
    const result = await createAssignmentGoogleDoc({
      assignmentId,
      title: title ?? 'DueD8 Submission',
      content
    });
    return success(result);
  } catch (error) {
    mainError('assignments:createGoogleDoc failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to create Google Doc');
  }
});

ipcMain.handle('assignments:exportPdf', async (event, payload) => {
  try {
    if (!featureFlags.solveExports) {
      return failure('Exports are disabled');
    }
    const { assignmentId, html, courseCode, assignmentName } = PdfExportSchema.parse(payload ?? {});
    const defaultName = `${sanitizeCourseCode(courseCode)}_${slugifyAssignment(assignmentName)}_${formatDateStamp(new Date())}.pdf`;
    const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialog.showSaveDialog(parent, {
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) {
      return success({ canceled: true });
    }
    const pdfBuffer = await renderPdfFromHtml(html);
    await savePdfToPath(pdfBuffer, result.filePath);
    savePdfPath(assignmentId, result.filePath);
    mainLog('Saved PDF export for assignment', assignmentId, result.filePath);
    return success({ canceled: false, filePath: result.filePath });
  } catch (error) {
    mainError('assignments:exportPdf failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to export PDF');
  }
});

ipcMain.handle('tokens:checkAndConsume', async (_event, payload) => {
  try {
    const parsed = TokenUsageSchema.parse(payload ?? {});
    if (!featureFlags.tokenGating) {
      return success({
        allowedTokens: parsed.requestedTokens,
        limited: false,
        assignmentRemaining: MAX_TOKENS_PER_ASSIGNMENT,
        dailyRemaining: MAX_TOKENS_PER_24H,
        requestedTokens: parsed.requestedTokens,
        assignmentUsed: 0,
        dailyUsed: 0
      });
    }
    const result = checkAndConsumeTokens(parsed);
    return success(result);
  } catch (error) {
    mainError('tokens:checkAndConsume failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to record token usage');
  }
});

ipcMain.handle('students.add', (_e, payload) => {
  const s = StudentSchema.parse(payload);
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO student (first_name,last_name,county) VALUES (?,?,?)`
  );
  const info = stmt.run(s.first_name, s.last_name, s.county);
  return { id: Number(info.lastInsertRowid) };
});

ipcMain.handle('students.list', () => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, first_name, last_name, county, created_at FROM student ORDER BY last_name, first_name`
  ).all();
  return rows;
});

ipcMain.handle('events.upsert', (_e, name: string, event_date: string) => {
  if (!name) throw new Error('name required');
  if (!event_date) throw new Error('event_date required');
  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM event WHERE name=? AND event_date=?`
  ).get(name, event_date) as { id: number } | undefined;
  if (existing && typeof existing.id !== 'undefined') {
    return { id: Number(existing.id), updated: false };
  }
  const info = db.prepare(`INSERT INTO event (name, event_date) VALUES (?,?)`).run(name, event_date);
  return { id: Number(info.lastInsertRowid), updated: false };
});

ipcMain.handle('attendance.set', (_e, student_id: number, event_id: number, status: 'Present'|'Absent'|'NO AMP') => {
  const db = getDb();
  db.prepare(`
    INSERT INTO attendance (student_id, event_id, status)
    VALUES (?,?,?)
    ON CONFLICT(student_id, event_id) DO UPDATE SET status=excluded.status
  `).run(student_id, event_id, status);
  return true;
});