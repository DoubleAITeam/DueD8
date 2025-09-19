// src/main/ipc.ts
import { ipcMain } from 'electron';
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import { z } from 'zod';
import { getDb } from './db';
import { clearToken, fetchCanvasJson, getToken, setToken, validateToken } from './canvasService';
import type { CanvasGetPayload } from './canvasService';
import type { IpcResult } from '../src/shared/ipc';
import { mainError, mainLog } from './logger';
import {
  processAssignmentUploads,
  processRemoteAttachments,
  type ProcessedFile,
  type RemoteAttachmentDescriptor
} from './fileProcessing';
import { sanitizeAssignment } from './ai/pipeline/sanitize';
import { classify, type AssignmentType } from './ai/pipeline/classify';
import { writeDeliverable, type Deliverable } from './ai/pipeline/writeDeliverable';
import { lintDeliverableText } from './ai/pipeline/lint';
import { renderDocx } from './render/docx/renderDocx';

ipcMain.handle('ping', () => 'pong');

const ClassificationRequest = z.object({
  text: z.string(),
  title: z.string().optional(),
  course: z.string().optional()
});

const DeliverableRequest = ClassificationRequest.extend({
  extension: z.union([z.literal('pdf'), z.literal('docx')])
});

ipcMain.handle(
  'ai:classifyAssignment',
  async (_event, payload): Promise<IpcResult<{ type: AssignmentType }>> => {
    try {
      const input = ClassificationRequest.parse(payload);
      const clean = buildCleanInput(input);
      const type = await classify(clean);
      return success({ type });
    } catch (error) {
      mainError('ai:classifyAssignment failed', (error as Error).message);
      return failure((error as Error).message || 'Classification failed');
    }
  }
);

ipcMain.handle(
  'ai:generateDeliverable',
  async (
    _event,
    payload
  ): Promise<
    IpcResult<
      | { type: AssignmentType; status: 'instructions'; reason: string }
      | {
          type: AssignmentType;
          status: 'deliverable';
          plainText: string;
          docx: string;
          mimeType: string;
        }
    >
  > => {
    try {
      const input = DeliverableRequest.parse(payload);
      const clean = buildCleanInput(input);
      const type = await classify(clean);
      if (type === 'instructions') {
        return success({ type, status: 'instructions', reason: 'This file is instructions. Generate a guide instead.' });
      }

      const deliverable = await writeDeliverable(clean);
      const sanitized: Deliverable = {
        ...deliverable,
        sections: deliverable.sections.map((section) => ({
          heading: section.heading,
          body: lintDeliverableText(section.body)
        })),
        references: deliverable.references?.map((ref) => lintDeliverableText(ref))
      };
      const plainText = deliverableToPlainText(sanitized);
      const docxResult = await renderDocx(sanitized);
      const docxBase64 = Buffer.from(docxResult.buffer).toString('base64');
      await cleanupTempDocx(docxResult.path);
      return success({
        type,
        status: 'deliverable',
        plainText,
        docx: docxBase64,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    } catch (error) {
      mainError('ai:generateDeliverable failed', (error as Error).message);
      return failure((error as Error).message || 'Failed to generate deliverable');
    }
  }
);

type ClassificationPayload = { text: string; title?: string; course?: string };
type DeliverablePayload = {
  text: string;
  title?: string;
  course?: string;
  extension: 'pdf' | 'docx';
};

function success<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function failure(error: string, status?: number): IpcResult<never> {
  return status === undefined ? { ok: false, error } : { ok: false, error, status };
}

function joinContextsText(input: string) {
  return typeof input === 'string' ? input : '';
}

function buildCleanInput(payload: ClassificationPayload) {
  const clean = sanitizeAssignment(joinContextsText(payload.text));
  if (payload.title) {
    clean.title = payload.title;
  }
  if (payload.course) {
    clean.course = payload.course;
  }
  return clean;
}

function deliverableToPlainText(deliverable: Deliverable) {
  const lines: string[] = [];
  if (deliverable.title) {
    lines.push(deliverable.title);
  }
  for (const section of deliverable.sections) {
    if (section.heading) {
      lines.push(section.heading);
    }
    lines.push(section.body);
  }
  if (deliverable.references?.length) {
    lines.push('References');
    lines.push(...deliverable.references);
  }
  return lintDeliverableText(lines.join('\n\n'));
}

async function cleanupTempDocx(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    await fsPromises.rm(dir, { recursive: true, force: true });
  } catch (error) {
    mainError('cleanupTempDocx failed', (error as Error).message);
  }
}

const StudentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  county: z.enum(['Fairfax', 'Sci-Tech'])
});

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
      const eligibleAttachments: RemoteAttachmentDescriptor[] = [];
      attachments.forEach((attachment, index) => {
        const name = attachment.display_name || attachment.filename || `Attachment ${attachment.id ?? index + 1}`;
        const ext = name ? path.extname(name).toLowerCase() : '';
        if (!name || !attachment.url || !['.pdf', '.docx', '.txt'].includes(ext)) {
          return;
        }
        eligibleAttachments.push({
          url: attachment.url,
          name,
          type: attachment.content_type,
          createdAt: attachment.created_at ?? null,
          updatedAt: attachment.updated_at ?? null
        });
      });

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