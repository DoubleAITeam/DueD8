export const MAX_TOKENS_PER_ASSIGNMENT = 6000;
export const MAX_TOKENS_PER_24H = 12000;
export const GRACE_COMPLETION_TOKENS = 400;

export const TOKEN_USAGE_TABLE = 'token_usage';

export type TokenLimit = 'assignment' | 'daily';

export type TokenLimitCheckResult = {
  allowed: boolean;
  grantedTokens: number;
  limit?: TokenLimit;
  remainingAssignmentTokens: number;
  remainingDailyTokens: number;
  requestedTokens: number;
};
