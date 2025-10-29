import { bootstrapBudgetState, useBudgetStore } from '../../renderer/state/budget';
import { logEvent } from '../../lib/analytics';

function normaliseCost(input: number): number {
  if (!Number.isFinite(input) || input <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(input));
}

export async function ensureBudgetAllowance(cost: number, feature: string): Promise<boolean> {
  await bootstrapBudgetState();
  const store = useBudgetStore.getState();
  const normalisedCost = normaliseCost(cost);

  if (normalisedCost <= 0) {
    return true;
  }

  let result: { ok: boolean; used: number; limit: number };
  try {
    result = await window.dued8.budget.checkAndReserve(normalisedCost);
  } catch (error) {
    console.error('[budget] Failed to reserve budget allowance', error);
    throw error;
  }
  if (!result) {
    return true;
  }

  if (!result.ok) {
    const usage = Number.isFinite(result.used) ? result.used : store.used;
    const limit = Number.isFinite(result.limit) ? result.limit : store.cap;
    store.setBudget({
      used: usage,
      cap: limit,
      plan: store.plan,
      isOverCap: usage >= limit
    });
    logEvent('token_budget.action_blocked', {
      feature,
      usage,
      limit,
      plan: store.plan
    });
    store.showUpgradeModal({
      source: feature,
      usage,
      limit
    });
    return false;
  }

  const usage = Number.isFinite(result.used) ? result.used : store.used;
  const limit = Number.isFinite(result.limit) ? result.limit : store.cap;
  store.setBudget({
    used: usage,
    cap: limit,
    plan: store.plan,
    isOverCap: usage >= limit
  });
  return true;
}

export async function releaseBudgetReservation(cost: number): Promise<void> {
  const normalisedCost = normaliseCost(cost);
  if (normalisedCost <= 0) {
    return;
  }
  try {
    const next = await window.dued8.budget.release(normalisedCost);
    if (next) {
      const store = useBudgetStore.getState();
      store.setBudget(next);
    }
  } catch (error) {
    console.error('[budget] Failed to release reserved budget', error);
  }
}
