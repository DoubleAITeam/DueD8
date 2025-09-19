import { getDb } from './db';

const DEFAULT_USER_ID = 'local-user';

export type TokenUsageSummary = {
  assignmentTotal: number;
  last24hTotal: number;
};

export type LogTokenUsageOptions = {
  assignmentId: number;
  courseId?: number | null;
  tokens: number;
  userId?: string;
};

function normaliseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function getTokenUsageSummary(
  assignmentId: number,
  userId: string = DEFAULT_USER_ID
): TokenUsageSummary {
  const db = getDb();
  const assignmentRow = db
    .prepare(`SELECT COALESCE(SUM(tokens), 0) AS total FROM token_usage WHERE assignment_id = ?`)
    .get(assignmentId) as { total: number | string | null } | undefined;
  const assignmentTotal = normaliseNumber(assignmentRow?.total ?? 0);

  const windowRow = db
    .prepare(
      `SELECT COALESCE(SUM(tokens), 0) AS total FROM token_usage WHERE user_id = ? AND created_at >= datetime('now', '-24 hours')`
    )
    .get(userId) as { total: number | string | null } | undefined;
  const last24hTotal = normaliseNumber(windowRow?.total ?? 0);

  return { assignmentTotal, last24hTotal };
}

export function logTokenUsage({
  assignmentId,
  courseId,
  tokens,
  userId = DEFAULT_USER_ID
}: LogTokenUsageOptions) {
  const safeTokens = Number.isFinite(tokens) && tokens > 0 ? Math.round(tokens) : 0;
  if (safeTokens <= 0) {
    return { recorded: false, tokens: 0 };
  }
  const db = getDb();
  db.prepare(
    `INSERT INTO token_usage (assignment_id, course_id, user_id, tokens, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(assignmentId, courseId ?? null, userId, safeTokens);
  return { recorded: true, tokens: safeTokens };
}
