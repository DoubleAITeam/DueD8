import { bootstrapBudgetState, useBudgetStore } from '../state/budget';
import { trackTokenBudgetActionBlocked } from '../../lib/analytics';

const BLOCK_ERROR_CODE = 'E_BUDGET_EXCEEDED';

export function withBudgetGate<T extends unknown[], R>(
  entrypoint: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    await bootstrapBudgetState();
    const store = useBudgetStore.getState();
    const state = await window.dued8.budget.getState();
    store.setBudget(state);
    let blockedTracked = false;

    if (state.isOverCap) {
      store.openUpgradeModal();
      trackTokenBudgetActionBlocked(entrypoint, state);
      blockedTracked = true;
      const error = new Error(`Budget exceeded for ${entrypoint}`);
      (error as { code?: string }).code = BLOCK_ERROR_CODE;
      throw error;
    }

    try {
      return await fn(...args);
    } catch (error) {
      if ((error as { code?: string }).code === BLOCK_ERROR_CODE) {
        store.openUpgradeModal();
        if (!blockedTracked) {
          trackTokenBudgetActionBlocked(entrypoint, useBudgetStore.getState());
          blockedTracked = true;
        }
      }
      throw error;
    }
  };
}
