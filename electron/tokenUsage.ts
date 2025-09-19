import { MAX_TOKENS_PER_24H, MAX_TOKENS_PER_ASSIGNMENT, GRACE_COMPLETION_TOKENS } from '../src/config/tokens';
import { getDb } from './db';

export function normaliseEmail(email?: string | null) {
  if (!email) {
    return 'anonymous';
  }
  return email.trim().toLowerCase();
}

export function getAssignmentUsage(userEmail: string, assignmentId: number) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(tokens_used), 0) as total FROM token_usage WHERE user_email = ? AND assignment_id = ?`
    )
    .get(userEmail, assignmentId) as { total: number } | undefined;
  return row?.total ?? 0;
}

export function getDailyUsage(userEmail: string) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(tokens_used), 0) as total FROM token_usage WHERE user_email = ? AND datetime(created_at) >= datetime('now', '-1 day')`
    )
    .get(userEmail) as { total: number } | undefined;
  return row?.total ?? 0;
}

export function recordTokenUsage(userEmail: string, assignmentId: number, tokensUsed: number) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO token_usage (user_email, assignment_id, tokens_used) VALUES (?, ?, ?)`
  );
  stmt.run(userEmail, assignmentId, Math.max(tokensUsed, 0));
}

export function evaluateTokenRequest({
  assignmentId,
  tokensRequested,
  userEmail
}: {
  assignmentId: number;
  tokensRequested: number;
  userEmail?: string | null;
}) {
  const normalisedEmail = normaliseEmail(userEmail);
  const usedForAssignment = getAssignmentUsage(normalisedEmail, assignmentId);
  const usedForDay = getDailyUsage(normalisedEmail);
  const remainingAssignment = Math.max(MAX_TOKENS_PER_ASSIGNMENT - usedForAssignment, 0);
  const remainingDaily = Math.max(MAX_TOKENS_PER_24H - usedForDay, 0);

  const hardLimit = Math.min(remainingAssignment, remainingDaily);
  const graceLimit = Math.min(
    remainingAssignment + GRACE_COMPLETION_TOKENS,
    remainingDaily + GRACE_COMPLETION_TOKENS
  );

  const grantedTokens = Math.min(tokensRequested, Math.max(hardLimit, 0));

  if (tokensRequested <= hardLimit) {
    return {
      allowed: true,
      grantedTokens: tokensRequested,
      limit: undefined,
      remainingAssignmentTokens: remainingAssignment - tokensRequested,
      remainingDailyTokens: remainingDaily - tokensRequested,
      requestedTokens: tokensRequested,
      graceApplied: false
    } as const;
  }

  if (tokensRequested <= graceLimit) {
    return {
      allowed: false,
      grantedTokens,
      limit: remainingAssignment < remainingDaily ? ('assignment' as const) : ('daily' as const),
      remainingAssignmentTokens: remainingAssignment,
      remainingDailyTokens: remainingDaily,
      requestedTokens: tokensRequested,
      graceApplied: true
    } as const;
  }

  return {
    allowed: false,
    grantedTokens,
    limit: remainingAssignment <= remainingDaily ? ('assignment' as const) : ('daily' as const),
    remainingAssignmentTokens: remainingAssignment,
    remainingDailyTokens: remainingDaily,
    requestedTokens: tokensRequested,
    graceApplied: false
  } as const;
}
