// src/main/ipc.ts
import { app, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
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
import {
  createOrUpdateGoogleDoc,
  getAssignmentGoogleDoc,
  isGoogleConnected
} from './googleService';
import { renderHtmlToPdfBuffer } from './pdfService';
import { getTokenAllowance, recordTokenUsage } from './tokenService';

ipcMain.handle('ping', () => 'pong');

const StudentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  county: z.enum(['Fairfax', 'Sci-Tech'])
});

const success = <T>(data: T): IpcResult<T> => ({ ok: true, data });
const failure = (error: string, status?: number): IpcResult<never> =>
  status === undefined ? { ok: false, error } : { ok: false, error, status };

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

const TokenAllowanceRequest = z.object({
  canvasId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  slug: z.string().min(1),
  userId: z.string().min(1),
  requestedTokens: z.number().min(0)
});

const TokenUsageRecordRequest = z.object({
  canvasId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  slug: z.string().min(1),
  userId: z.string().min(1),
  tokens: z.number().min(0)
});

const GoogleDocRequest = z.object({
  canvasId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1)
});

const GoogleDocLookupRequest = z.object({
  canvasId: z.number().int().positive()
});

const PdfExportRequest = z.object({
  html: z.string().min(1),
  courseCode: z.string().min(1),
  assignmentSlug: z.string().min(1)
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
  html_url?: string | null;
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

function sanitizeForFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
}

function formatDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

ipcMain.handle(
  'assignments:fetchInstructorContext',
  async (
    _event,
    payload
  ): Promise<
    IpcResult<{
      entries: Array<{ fileName: string; content: string; uploadedAt: number }>;
      attachments: Array<{ id: string; name: string; url: string; contentType: string | null }>;
      htmlUrl: string | null;
    }>
  > => {
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
        return success({ entries: [], attachments: [], htmlUrl: null });
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

      const attachmentSummaries = attachments
        .map((attachment, index) => {
          if (!attachment?.url) {
            return null;
          }
          const displayName =
            attachment.display_name || attachment.filename || `Attachment ${attachment.id ?? index + 1}`;
          return {
            id: String(attachment.id ?? index + 1),
            name: displayName,
            url: attachment.url,
            contentType: attachment.content_type ?? null
          };
        })
        .filter((entry): entry is { id: string; name: string; url: string; contentType: string | null } => Boolean(entry));

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

      return success({
        entries,
        attachments: attachmentSummaries,
        htmlUrl: typeof assignment.html_url === 'string' ? assignment.html_url : null
      });
    } catch (error) {
      mainError('assignments:fetchInstructorContext failed', (error as Error).message);
      return failure((error as Error).message || 'Failed to load instructor context');
    }
  }
);

ipcMain.handle('tokens:getAllowance', async (_event, payload): Promise<IpcResult<{
  allowedTokens: number;
  limitHit: boolean;
  remainingAssignment: number;
  remainingDaily: number;
}>> => {
  try {
    const data = TokenAllowanceRequest.parse(payload);
    const result = getTokenAllowance({
      canvasId: data.canvasId,
      courseId: data.courseId,
      slug: data.slug,
      userId: data.userId,
      requestedTokens: data.requestedTokens
    });
    return success({
      allowedTokens: result.allowedTokens,
      limitHit: result.limitHit,
      remainingAssignment: result.remainingAssignment,
      remainingDaily: result.remainingDaily
    });
  } catch (error) {
    mainError('tokens:getAllowance failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to calculate token allowance');
  }
});

ipcMain.handle('tokens:recordUsage', async (_event, payload): Promise<IpcResult<null>> => {
  try {
    const data = TokenUsageRecordRequest.parse(payload);
    const assignment = getTokenAllowance({
      canvasId: data.canvasId,
      courseId: data.courseId,
      slug: data.slug,
      userId: data.userId,
      requestedTokens: 0
    }).assignment;
    recordTokenUsage(assignment.id, { userId: data.userId, tokens: data.tokens });
    return success(null);
  } catch (error) {
    mainError('tokens:recordUsage failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to record token usage');
  }
});

ipcMain.handle('google:isConnected', async (): Promise<IpcResult<{ connected: boolean }>> => {
  try {
    const connected = await isGoogleConnected();
    return success({ connected });
  } catch (error) {
    mainError('google:isConnected failed', (error as Error).message);
    return failure('Failed to determine Google connection');
  }
});

ipcMain.handle('google:getAssignmentDoc', async (_event, payload): Promise<IpcResult<{
  documentId: string | null;
  documentUrl: string | null;
}>> => {
  try {
    const data = GoogleDocLookupRequest.parse(payload);
    const record = getAssignmentGoogleDoc(data.canvasId);
    return success({
      documentId: record?.google_doc_id ?? null,
      documentUrl: record?.google_doc_url ?? null
    });
  } catch (error) {
    mainError('google:getAssignmentDoc failed', (error as Error).message);
    return failure('Failed to load Google Doc link');
  }
});

ipcMain.handle('google:createDoc', async (_event, payload): Promise<IpcResult<{
  documentId: string;
  documentUrl: string;
}>> => {
  try {
    const data = GoogleDocRequest.parse(payload);
    const result = await createOrUpdateGoogleDoc({
      canvasId: data.canvasId,
      courseId: data.courseId,
      slug: data.slug,
      title: data.title,
      content: data.content
    });
    return success(result);
  } catch (error) {
    mainError('google:createDoc failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to create Google Doc');
  }
});

ipcMain.handle('solution:exportPdf', async (_event, payload): Promise<IpcResult<{ filePath: string | null; cancelled?: boolean }>> => {
  try {
    const data = PdfExportRequest.parse(payload);
    const safeCourse = sanitizeForFileName(data.courseCode) || 'Course';
    const safeSlug = sanitizeForFileName(data.assignmentSlug) || 'assignment';
    const stamp = formatDateStamp(new Date());
    const defaultName = `${safeCourse}_${safeSlug}_${stamp}.pdf`;
    const defaultDirectory = app.getPath('downloads');
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: path.join(defaultDirectory, defaultName),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) {
      return success({ filePath: null, cancelled: true });
    }
    const buffer = await renderHtmlToPdfBuffer(data.html);
    await fs.writeFile(filePath, buffer);
    return success({ filePath });
  } catch (error) {
    mainError('solution:exportPdf failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to export PDF');
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