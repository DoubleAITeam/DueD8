export const MAX_TOKENS_PER_ASSIGNMENT = 6000;
export const MAX_TOKENS_PER_24H = 12000;
export const GRACE_COMPLETION_TOKENS = 400;

export type TokenBudgetResponse = {
  allowedTokens: number;
  limitType: 'assignment' | 'rolling' | null;
  remainingAssignment: number;
  remaining24h: number;
  estimatedRemainingTokens: number;
};
