import { create } from 'zustand';
import type { BudgetState } from '../../../electron/tokenBudget';

type BudgetStore = BudgetState & {
  lastNotifiedAt: number | null;
  upgradeModalOpen: boolean;
  upgradeModalSource: string | null;
  upgradeModalUsage: number | null;
  upgradeModalLimit: number | null;
  setBudget: (state: BudgetState) => void;
  markNotified: (timestamp?: number) => void;
  showUpgradeModal: (payload?: { source?: string; usage?: number; limit?: number }) => void;
  openUpgradeModal: (source?: string) => void;
  closeUpgradeModal: () => void;
};

const DEFAULT_BUDGET_STATE: BudgetState = {
  used: 0,
  cap: 7500,
  isOverCap: false,
  plan: 'FREE'
};

export const useBudgetStore = create<BudgetStore>((set) => ({
  ...DEFAULT_BUDGET_STATE,
  lastNotifiedAt: null,
  upgradeModalOpen: false,
  upgradeModalSource: null,
  upgradeModalUsage: null,
  upgradeModalLimit: null,
  setBudget: (budget) =>
    set((state) => ({
      ...state,
      used: budget.used,
      cap: budget.cap,
      plan: budget.plan,
      isOverCap: budget.isOverCap
    })),
  markNotified: (timestamp) =>
    set({
      lastNotifiedAt: typeof timestamp === 'number' ? timestamp : Date.now()
    }),
  showUpgradeModal: (payload) =>
    set((state) => ({
      ...state,
      upgradeModalOpen: true,
      lastNotifiedAt: Date.now(),
      upgradeModalSource: payload?.source ?? state.upgradeModalSource ?? null,
      upgradeModalUsage:
        typeof payload?.usage === 'number' ? payload?.usage : state.upgradeModalUsage,
      upgradeModalLimit:
        typeof payload?.limit === 'number' ? payload?.limit : state.upgradeModalLimit
    })),
  openUpgradeModal: (source) =>
    set((state) => ({
      ...state,
      upgradeModalOpen: true,
      lastNotifiedAt: Date.now(),
      upgradeModalSource: source ?? state.upgradeModalSource ?? null
    })),
  closeUpgradeModal: () => set((state) => ({ ...state, upgradeModalOpen: false }))
}));

let initialized = false;
let unsubscribeFns: Array<() => void> = [];

function teardownListeners(): void {
  unsubscribeFns.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore teardown failures
    }
  });
  unsubscribeFns = [];
}

export async function bootstrapBudgetState(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  try {
    const state = await window.dued8.budget.getState();
    useBudgetStore.getState().setBudget(state);
    if (state.isOverCap) {
      useBudgetStore.getState().showUpgradeModal({
        source: 'system',
        usage: state.used,
        limit: state.cap
      });
    }
  } catch (error) {
    console.error('[budget] Failed to fetch initial budget state', error);
  }

  const onChanged = window.dued8.budget.onChanged((next) => {
    useBudgetStore.getState().setBudget(next);
  });
  const onBlocked = window.dued8.budget.onBlocked((next) => {
    useBudgetStore.getState().setBudget(next);
    useBudgetStore.getState().showUpgradeModal({
      source: 'system',
      usage: next.used,
      limit: next.cap
    });
  });
  const onPaywall = window.dued8.ai.paywall.onOpen(() => {
    useBudgetStore.getState().openUpgradeModal();
  });

  unsubscribeFns = [onChanged, onBlocked, onPaywall];
}

export function resetBudgetListeners(): void {
  initialized = false;
  teardownListeners();
}
