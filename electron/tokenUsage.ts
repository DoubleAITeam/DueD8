import { getDb } from './db';
import {
  GRACE_COMPLETION_TOKENS,
  MAX_TOKENS_PER_24H,
  MAX_TOKENS_PER_ASSIGNMENT
} from '../src/config/tokens';

export type TokenUsageResult = {
  allowedTokens: number;
  limited: boolean;
  assignmentRemaining: number;
  dailyRemaining: number;
  requestedTokens: number;
  assignmentUsed: number;
  dailyUsed: number;
};

function clamp(value: number) {
  return value < 0 ? 0 : value;
}

export function checkAndConsumeTokens(payload: {
  userId: string;
  assignmentId: number;
  requestedTokens: number;
}): TokenUsageResult {
  const db = getDb();
  const { userId, assignmentId, requestedTokens } = payload;

  const assignmentRow = db
    .prepare('SELECT COALESCE(SUM(tokens), 0) AS total FROM token_usage_log WHERE assignment_id = ?')
    .get(assignmentId) as { total: number };
  const dailyRow = db
    .prepare(
      `SELECT COALESCE(SUM(tokens), 0) AS total
       FROM token_usage_log
       WHERE user_id = ? AND created_at >= datetime('now', '-24 hours')`
    )
    .get(userId) as { total: number };

  const assignmentUsed = Number(assignmentRow?.total ?? 0);
  const dailyUsed = Number(dailyRow?.total ?? 0);

  const assignmentRemaining = MAX_TOKENS_PER_ASSIGNMENT - assignmentUsed;
  const dailyRemaining = MAX_TOKENS_PER_24H - dailyUsed;

  const assignmentAllowance =
    requestedTokens <= assignmentRemaining
      ? requestedTokens
      : clamp(assignmentRemaining + GRACE_COMPLETION_TOKENS);
  const dailyAllowance =
    requestedTokens <= dailyRemaining
      ? requestedTokens
      : clamp(dailyRemaining + GRACE_COMPLETION_TOKENS);

  const allowedTokens = clamp(Math.min(requestedTokens, assignmentAllowance, dailyAllowance));
  const limited = allowedTokens < requestedTokens;

  if (allowedTokens > 0) {
    db.prepare(
      `INSERT INTO token_usage_log (user_id, assignment_id, tokens, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(userId, assignmentId, allowedTokens);
  }

  return {
    allowedTokens,
    limited,
    assignmentRemaining: clamp(assignmentRemaining - allowedTokens),
    dailyRemaining: clamp(dailyRemaining - allowedTokens),
    requestedTokens,
    assignmentUsed: assignmentUsed + allowedTokens,
    dailyUsed: dailyUsed + allowedTokens
  };
}
