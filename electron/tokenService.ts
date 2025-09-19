import { MAX_TOKENS_PER_24H, MAX_TOKENS_PER_ASSIGNMENT, GRACE_COMPLETION_TOKENS } from '../src/config/tokens';
import { getDb } from './db';
import { mainError, mainLog } from './logger';

export type AssignmentRecord = {
  id: number;
  canvas_id: number;
  course_id: number;
  slug: string;
  google_doc_id: string | null;
  google_doc_url: string | null;
};

function normaliseSlug(slug: string) {
  const trimmed = slug.trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9-_]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || 'assignment';
}

function mapRow(row: Record<string, unknown> | undefined | null): AssignmentRecord | null {
  if (!row) {
    return null;
  }
  return {
    id: Number(row.id),
    canvas_id: Number(row.canvas_id),
    course_id: Number(row.course_id),
    slug: String(row.slug),
    google_doc_id: row.google_doc_id ? String(row.google_doc_id) : null,
    google_doc_url: row.google_doc_url ? String(row.google_doc_url) : null
  };
}

export function getAssignmentRecordByCanvasId(canvasId: number) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, canvas_id, course_id, slug, google_doc_id, google_doc_url FROM assignment_record WHERE canvas_id = ?`
    )
    .get(canvasId) as Record<string, unknown> | undefined;
  return mapRow(row);
}

export function ensureAssignmentRecord(canvasId: number, courseId: number, slug: string) {
  const db = getDb();
  const existing = getAssignmentRecordByCanvasId(canvasId);
  const normalisedSlug = normaliseSlug(slug);
  if (existing) {
    if (existing.course_id !== courseId || existing.slug !== normalisedSlug) {
      const now = new Date().toISOString();
      db.prepare(`UPDATE assignment_record SET course_id = ?, slug = ?, updated_at = ? WHERE id = ?`).run(
        courseId,
        normalisedSlug,
        now,
        existing.id
      );
      return {
        ...existing,
        course_id: courseId,
        slug: normalisedSlug
      };
    }
    return existing;
  }
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO assignment_record (canvas_id, course_id, slug, created_at, updated_at) VALUES (?,?,?,?,?)`
    )
    .run(canvasId, courseId, normalisedSlug, now, now);
  return {
    id: Number(info.lastInsertRowid),
    canvas_id: canvasId,
    course_id: courseId,
    slug: normalisedSlug,
    google_doc_id: null,
    google_doc_url: null
  };
}

export function updateAssignmentGoogleDoc(
  assignmentId: number,
  options: { documentId: string; documentUrl: string }
) {
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE assignment_record
         SET google_doc_id = ?, google_doc_url = ?, updated_at = ?
       WHERE id = ?
    `).run(options.documentId, options.documentUrl, now, assignmentId);
  } catch (error) {
    mainError('updateAssignmentGoogleDoc failed', (error as Error).message);
    throw error;
  }
}

export function recordTokenUsage(
  assignmentId: number,
  options: { userId: string; tokens: number }
) {
  if (!options.tokens || options.tokens <= 0) {
    return;
  }
  try {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO token_usage (assignment_id, user_id, tokens, used_at) VALUES (?,?,?,?)`
    ).run(assignmentId, options.userId, Math.round(options.tokens), now);
    db.prepare(`UPDATE assignment_record SET updated_at = ? WHERE id = ?`).run(now, assignmentId);
  } catch (error) {
    mainError('recordTokenUsage failed', (error as Error).message);
    throw error;
  }
}

export function getTokenAllowance(options: {
  canvasId: number;
  courseId: number;
  slug: string;
  userId: string;
  requestedTokens: number;
}) {
  const assignment = ensureAssignmentRecord(options.canvasId, options.courseId, options.slug);
  const db = getDb();
  const assignmentRow = db
    .prepare(`SELECT IFNULL(SUM(tokens), 0) as total FROM token_usage WHERE assignment_id = ?`)
    .get(assignment.id) as { total?: number } | undefined;
  const assignmentUsed = assignmentRow?.total ?? 0;
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const dailyRow = db
    .prepare(
      `SELECT IFNULL(SUM(tokens), 0) as total FROM token_usage WHERE user_id = ? AND used_at >= ?`
    )
    .get(options.userId, windowStart) as { total?: number } | undefined;
  const dailyUsed = dailyRow?.total ?? 0;

  const remainingAssignment = Math.max(MAX_TOKENS_PER_ASSIGNMENT - assignmentUsed, 0);
  const remainingDaily = Math.max(MAX_TOKENS_PER_24H - dailyUsed, 0);
  const available = Math.max(Math.min(remainingAssignment, remainingDaily), 0);

  const requested = Math.max(0, Math.round(options.requestedTokens));
  const limitHit = requested > available;

  const allowedBase = limitHit
    ? Math.max(available, 0) + GRACE_COMPLETION_TOKENS
    : Math.max(available, 0);
  const allowedTokens = Math.min(requested, Math.max(allowedBase, 0));

  mainLog(
    'token allowance',
    JSON.stringify({
      assignmentId: assignment.id,
      requested,
      allowedTokens,
      remainingAssignment,
      remainingDaily,
      limitHit
    })
  );

  return {
    assignment,
    allowedTokens,
    limitHit,
    remainingAssignment,
    remainingDaily
  };
}
