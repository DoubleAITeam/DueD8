import { mainWarn } from '../logger';
import { getBudgetState } from '../tokenBudget';
import { trackTokenBudgetActionBlocked } from '../analytics';

export class BudgetExceededError extends Error {
  code = 'E_BUDGET_EXCEEDED';

  constructor() {
    super('Token budget exceeded');
    this.name = 'BudgetExceededError';
  }
}

export function assertBudgetAvailable(entrypoint: string): void {
  const state = getBudgetState();
  if (!state.isOverCap) {
    return;
  }
  trackTokenBudgetActionBlocked(entrypoint, state);
  mainWarn(
    'budget:blocked_attempt',
    `Budget exceeded for entrypoint ${entrypoint} (used ${state.used}/${state.cap}).`
  );
  throw new BudgetExceededError();
}
