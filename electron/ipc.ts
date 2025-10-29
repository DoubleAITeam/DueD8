// src/main/ipc.ts
import { app, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { getDb } from './db';
import { clearToken, fetchCanvasJson, getToken, setToken, validateToken } from './canvasService';
import type { CanvasGetPayload } from './canvasService';
import type { IpcResult } from '../src/shared/ipc';
import { mainError, mainLog, mainWarn } from './logger';
import { readAiResetState } from './ai/state';
import {
  processAssignmentUploads,
  processRemoteAttachments,
  type ProcessedFile
} from './fileProcessing';
import './deliverables/ipc';
import './ipc/chat';
import {
  getBudgetState,
  incrementUsage as incrementBudgetUsage,
  decrementUsage as decrementBudgetUsage,
  setPlan as setBudgetPlan,
  setCap as setBudgetCap,
  resetBudget
} from './tokenBudget';
import {
  checkFlashcardQuota,
  createCard as createFlashcardCard,
  createDeck as createFlashcardDeck,
  deleteCard as deleteFlashcardCard,
  deleteDeck as deleteFlashcardDeck,
  getDeck as getFlashcardDeck,
  getSourceAsset as getFlashcardSource,
  incrementFlashcardQuotaUsage,
  listCardsByDeck as listFlashcardCards,
  listDecks as listFlashcardDecks,
  mergeDecks as mergeFlashcardDecks,
  moveCards as moveFlashcardCards,
  saveSourceAsset as saveFlashcardSource,
  searchCards as searchFlashcardCards,
  updateCard as updateFlashcardCard,
  updateDeck as updateFlashcardDeck
} from './flashcardsService';

ipcMain.handle('ping', () => 'pong');

ipcMain.handle('aiReset:getState', () => readAiResetState());

const PRO_FEATURE_CACHE_TTL = 5 * 60 * 1000;
const FALLBACK_PRO_FEATURES = [
  'Longer token limits',
  'Priority queue',
  'Multi-file renders',
  'Export to PDF/Docx',
  'Audit history'
];

type ProFeaturesCache = {
  features: string[];
  expiresAt: number;
};

let proFeaturesCache: ProFeaturesCache | null = null;

function sanitizeFeatureCopy(input: string): string {
  return input
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProFeatures(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const results: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const upper = trimmed.toUpperCase();
    if (upper.startsWith('PRO FEATURES')) {
      inSection = true;
      continue;
    }

    if (/^[-*]\s*\(PRO FEATURE\)/i.test(trimmed)) {
      const feature = sanitizeFeatureCopy(
        trimmed.replace(/^[-*]\s*\(PRO FEATURE\)\s*/i, '')
      );
      if (feature) {
        results.push(feature);
      }
      continue;
    }

    if (upper.startsWith('PRO:')) {
      const feature = sanitizeFeatureCopy(trimmed.slice(trimmed.indexOf(':') + 1));
      if (feature) {
        results.push(feature);
      }
      continue;
    }

    if (inSection) {
      if (/^[A-Z0-9\s]+:$/u.test(upper) && !upper.startsWith('PRO FEATURES')) {
        break;
      }
      if (trimmed.startsWith('-')) {
        const feature = sanitizeFeatureCopy(trimmed.replace(/^-+/, ''));
        if (feature) {
          results.push(feature);
        }
      }
    }
  }

  if (results.length) {
    return results.slice(0, 5);
  }

  return results
    .filter((feature, index, array) => array.indexOf(feature) === index)
    .slice(0, 5);
}

async function readProFeatures(): Promise<string[]> {
  const now = Date.now();
  if (proFeaturesCache && proFeaturesCache.expiresAt > now) {
    return proFeaturesCache.features;
  }

  try {
    const wipPath = path.join(app.getAppPath(), 'WIP.txt');
    const raw = await fs.readFile(wipPath, 'utf-8');
    const parsed = extractProFeatures(raw);
    const features = parsed.length ? parsed : FALLBACK_PRO_FEATURES;
    proFeaturesCache = {
      features,
      expiresAt: now + PRO_FEATURE_CACHE_TTL
    };
    return features;
  } catch (error) {
    mainWarn('wip:getProBullets', 'Failed to read WIP.txt', error);
    proFeaturesCache = {
      features: FALLBACK_PRO_FEATURES,
      expiresAt: now + PRO_FEATURE_CACHE_TTL
    };
    return FALLBACK_PRO_FEATURES;
  }
}

ipcMain.handle('budget:getState', () => getBudgetState());

ipcMain.handle('budget:checkAndReserve', (_event, payload: { cost: number }) => {
  const cost = Number(payload?.cost ?? 0);
  const { used, cap } = getBudgetState();

  if (!Number.isFinite(cost) || cost <= 0) {
    return { ok: true, used, limit: cap };
  }

  if (Number.isFinite(cap) && cap > 0 && used + cost > cap) {
    return { ok: false, used, limit: cap };
  }

  try {
    incrementBudgetUsage(cost);
    const next = getBudgetState();
    return { ok: true, used: next.used, limit: next.cap };
  } catch (error) {
    mainError('budget:checkAndReserve failed', error);
    throw error;
  }
});

ipcMain.handle('budget:release', (_event, payload: { cost: number }) => {
  const cost = Number(payload?.cost ?? 0);
  if (!Number.isFinite(cost) || cost <= 0) {
    return getBudgetState();
  }
  try {
    decrementBudgetUsage(cost);
    return getBudgetState();
  } catch (error) {
    mainError('budget:release failed', error);
    throw error;
  }
});

ipcMain.handle('budget:setPlan', (_event, plan: string) => {
  try {
    setBudgetPlan(plan);
    return getBudgetState();
  } catch (error) {
    mainError('budget:setPlan failed', error);
    throw error;
  }
});

ipcMain.handle('budget:setCap', (_event, cap: number) => {
  try {
    const numeric = Number(cap);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error('Invalid cap value');
    }
    setBudgetCap(numeric);
    return getBudgetState();
  } catch (error) {
    mainError('budget:setCap failed', error);
    throw error;
  }
});

ipcMain.handle('budget:reset', () => {
  resetBudget();
  return getBudgetState();
});

ipcMain.handle('budget:refreshPlan', () => {
  const plan = process.env.PLAN ?? 'FREE';
  setBudgetPlan(plan);
  return getBudgetState();
});

ipcMain.handle('budget:consume', (_event, amount: number) => {
  try {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error('Invalid token amount');
    }
    incrementBudgetUsage(numeric);
    return getBudgetState();
  } catch (error) {
    mainError('budget:consume failed', error);
    throw error;
  }
});

ipcMain.handle('pro:features', async () => readProFeatures());
ipcMain.handle('wip:getProBullets', async () => readProFeatures());

const StudentSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  county: z.enum(['Fairfax', 'Sci-Tech'])
});

const DeckScopeSchema = z.enum(['class', 'general']);

const CreateDeckSchema = z.object({
  title: z.string().min(1),
  scope: DeckScopeSchema,
  classId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional()
});

const UpdateDeckSchema = z.object({
  deckId: z.string().min(1),
  title: z.string().min(1).optional(),
  scope: DeckScopeSchema.optional(),
  classId: z.string().min(1).or(z.literal('')).or(z.null()).optional(),
  tags: z.array(z.string().min(1)).optional(),
  cardIds: z.array(z.string().min(1)).optional()
});

const DeleteDeckSchema = z.object({
  deckId: z.string().min(1)
});

const ListCardsSchema = z.object({
  deckId: z.string().min(1),
  sort: z.enum(['recent', 'alphabetical', 'studied']).optional()
});

const CreateCardSchema = z.object({
  deckId: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
  sourceIds: z.array(z.string().min(1)).optional()
});

const UpdateCardSchema = z.object({
  cardId: z.string().min(1),
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  sourceIds: z.array(z.string().min(1)).optional(),
  studiedCount: z.number().int().min(0).optional(),
  lastStudiedAt: z.string().nullable().optional()
});

const DeleteCardSchema = z.object({
  cardId: z.string().min(1)
});

const MoveCardsSchema = z.object({
  cardIds: z.array(z.string().min(1)).min(1),
  targetDeckId: z.string().min(1),
  position: z.union([z.number().int().nonnegative(), z.enum(['start', 'end'])]).optional()
});

const MergeDecksSchema = z.object({
  sourceDeckId: z.string().min(1),
  targetDeckId: z.string().min(1)
});

const SearchCardsSchema = z.object({
  query: z.string().min(1)
});

const SaveSourceSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(['paste', 'upload']),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  textExtract: z.string().min(1),
  createdAt: z.string().optional()
});

const GetSourceSchema = z.object({
  id: z.string().min(1)
});

const QuotaCheckSchema = z.object({
  userId: z.string().min(1)
});

const QuotaIncrementSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive()
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

ipcMain.handle('flashcards:listDecks', async () => {
  try {
    const decks = listFlashcardDecks();
    return success(decks);
  } catch (error) {
    mainError('flashcards:listDecks failed', (error as Error).message);
    return failure('Failed to list decks');
  }
});

ipcMain.handle('flashcards:getDeck', async (_event, payload) => {
  try {
    const { deckId } = DeleteDeckSchema.parse(payload);
    const deck = getFlashcardDeck(deckId);
    return success(deck);
  } catch (error) {
    mainError('flashcards:getDeck failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to get deck');
  }
});

ipcMain.handle('flashcards:createDeck', async (_event, payload) => {
  try {
    const parsed = CreateDeckSchema.parse(payload);
    const deck = createFlashcardDeck({
      title: parsed.title,
      scope: parsed.scope,
      classId: parsed.scope === 'class' ? parsed.classId : undefined,
      tags: parsed.tags
    });
    return success(deck);
  } catch (error) {
    mainError('flashcards:createDeck failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to create deck');
  }
});

ipcMain.handle('flashcards:updateDeck', async (_event, payload) => {
  try {
    const parsed = UpdateDeckSchema.parse(payload);
    const deck = updateFlashcardDeck(parsed.deckId, {
      title: parsed.title,
      scope: parsed.scope,
      classId:
        parsed.classId === undefined
          ? undefined
          : parsed.classId === '' || parsed.classId === null
            ? null
            : parsed.classId,
      tags: parsed.tags,
      cardIds: parsed.cardIds
    });
    return success(deck);
  } catch (error) {
    mainError('flashcards:updateDeck failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to update deck');
  }
});

ipcMain.handle('flashcards:deleteDeck', async (_event, payload) => {
  try {
    const { deckId } = DeleteDeckSchema.parse(payload);
    deleteFlashcardDeck(deckId);
    return success(null);
  } catch (error) {
    mainError('flashcards:deleteDeck failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to delete deck');
  }
});

ipcMain.handle('flashcards:listCards', async (_event, payload) => {
  try {
    const parsed = ListCardsSchema.parse(payload);
    const cards = listFlashcardCards(parsed.deckId, { sort: parsed.sort });
    return success(cards);
  } catch (error) {
    mainError('flashcards:listCards failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to list cards');
  }
});

ipcMain.handle('flashcards:createCard', async (_event, payload) => {
  try {
    const parsed = CreateCardSchema.parse(payload);
    const card = createFlashcardCard({
      deckId: parsed.deckId,
      front: parsed.front,
      back: parsed.back,
      tags: parsed.tags,
      sourceIds: parsed.sourceIds
    });
    return success(card);
  } catch (error) {
    mainError('flashcards:createCard failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to create card');
  }
});

ipcMain.handle('flashcards:updateCard', async (_event, payload) => {
  try {
    const parsed = UpdateCardSchema.parse(payload);
    const card = updateFlashcardCard(parsed.cardId, {
      front: parsed.front,
      back: parsed.back,
      tags: parsed.tags,
      sourceIds: parsed.sourceIds,
      studiedCount: parsed.studiedCount,
      lastStudiedAt: parsed.lastStudiedAt ?? undefined
    });
    return success(card);
  } catch (error) {
    mainError('flashcards:updateCard failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to update card');
  }
});

ipcMain.handle('flashcards:deleteCard', async (_event, payload) => {
  try {
    const { cardId } = DeleteCardSchema.parse(payload);
    deleteFlashcardCard(cardId);
    return success(null);
  } catch (error) {
    mainError('flashcards:deleteCard failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to delete card');
  }
});

ipcMain.handle('flashcards:moveCards', async (_event, payload) => {
  try {
    const parsed = MoveCardsSchema.parse(payload);
    const deck = moveFlashcardCards(parsed);
    return success(deck);
  } catch (error) {
    mainError('flashcards:moveCards failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to move cards');
  }
});

ipcMain.handle('flashcards:mergeDecks', async (_event, payload) => {
  try {
    const parsed = MergeDecksSchema.parse(payload);
    const deck = mergeFlashcardDecks(parsed);
    return success(deck);
  } catch (error) {
    mainError('flashcards:mergeDecks failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to merge decks');
  }
});

ipcMain.handle('flashcards:search', async (_event, payload) => {
  try {
    const parsed = SearchCardsSchema.parse(payload);
    const results = searchFlashcardCards(parsed.query);
    return success(results);
  } catch (error) {
    mainError('flashcards:search failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to search cards');
  }
});

ipcMain.handle('flashcards:saveSource', async (_event, payload) => {
  try {
    const parsed = SaveSourceSchema.parse(payload);
    const asset = saveFlashcardSource(parsed);
    return success(asset);
  } catch (error) {
    mainError('flashcards:saveSource failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to save source');
  }
});

ipcMain.handle('flashcards:getSource', async (_event, payload) => {
  try {
    const parsed = GetSourceSchema.parse(payload);
    const asset = getFlashcardSource(parsed.id);
    return success(asset);
  } catch (error) {
    mainError('flashcards:getSource failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to load source');
  }
});

ipcMain.handle('flashcards:quota:check', async (_event, payload) => {
  try {
    const { userId } = QuotaCheckSchema.parse(payload);
    const quota = checkFlashcardQuota(userId);
    return success(quota);
  } catch (error) {
    mainError('flashcards:quota:check failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to check quota');
  }
});

ipcMain.handle('flashcards:quota:increment', async (_event, payload) => {
  try {
    const parsed = QuotaIncrementSchema.parse(payload);
    const quota = incrementFlashcardQuotaUsage(parsed);
    return success(quota);
  } catch (error) {
    mainError('flashcards:quota:increment failed', (error as Error).message);
    return failure((error as Error).message || 'Failed to update quota');
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
