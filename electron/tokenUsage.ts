import { getDb } from './db';
import {
  GRACE_COMPLETION_TOKENS,
  MAX_TOKENS_PER_24H,
  MAX_TOKENS_PER_ASSIGNMENT,
  type TokenBudgetResponse
} from '../src/config/tokens';

export type TokenBudgetRequest = {
  userId: string;
  assignmentId: number;
  courseId?: number | null;
  requestedTokens: number;
};

export type TokenLogRequest = {
  userId: string;
  assignmentId: number;
  courseId?: number | null;
  tokensUsed: number;
};

function clampNonNegative(value: number) {
  return value > 0 ? value : 0;
}

function nowISO() {
  return new Date().toISOString();
}

export function requestTokenBudget(request: TokenBudgetRequest): TokenBudgetResponse {
  const db = getDb();
  const { userId, assignmentId, requestedTokens } = request;

  const assignmentRow = db
    .prepare(
      `SELECT COALESCE(SUM(tokens_used), 0) AS total FROM token_usage WHERE user_id = ? AND assignment_id = ?`
    )
    .get(userId, assignmentId) as { total: number };

  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rollingRow = db
    .prepare(
      `SELECT COALESCE(SUM(tokens_used), 0) AS total FROM token_usage WHERE user_id = ? AND created_at >= ?`
    )
    .get(userId, windowStart) as { total: number };

  const assignmentUsed = assignmentRow?.total ?? 0;
  const rollingUsed = rollingRow?.total ?? 0;

  const remainingAssignment = clampNonNegative(MAX_TOKENS_PER_ASSIGNMENT - assignmentUsed);
  const remaining24h = clampNonNegative(MAX_TOKENS_PER_24H - rollingUsed);

  const hardRemaining = Math.min(remainingAssignment, remaining24h);
  const allowedBase = clampNonNegative(hardRemaining);

  let allowedTokens = Math.min(requestedTokens, allowedBase);
  let limitType: TokenBudgetResponse['limitType'] = null;
  let estimatedRemainingTokens = 0;

  if (requestedTokens > allowedBase) {
    limitType = remainingAssignment <= remaining24h ? 'assignment' : 'rolling';
    const grace = Math.min(
      requestedTokens - allowedBase,
      Math.max(GRACE_COMPLETION_TOKENS, 0)
    );
    allowedTokens = Math.min(requestedTokens, allowedBase + grace);
    estimatedRemainingTokens = requestedTokens - allowedBase;
  }

  // Ensure we never return negative values.
  allowedTokens = clampNonNegative(allowedTokens);

  return {
    allowedTokens,
    limitType,
    remainingAssignment,
    remaining24h,
    estimatedRemainingTokens
  };
}

export function logTokenUsage(request: TokenLogRequest) {
  const db = getDb();
  const { userId, assignmentId, courseId = null, tokensUsed } = request;
  db.prepare(
    `INSERT INTO token_usage (user_id, assignment_id, course_id, tokens_used, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, assignmentId, courseId, tokensUsed, nowISO());
}
