import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { loadBudgetState, saveBudgetState, resetBudgetState } from './deliverables/dataStore';
import { trackTokenBudgetOverCap } from './analytics';
import { mainError } from './logger';

export type BudgetPlan = 'FREE' | 'PRO' | string;

export type BudgetState = {
  used: number;
  cap: number;
  isOverCap: boolean;
  plan: BudgetPlan;
};

type InternalState = BudgetState & {
  lastPersisted?: number;
  overCapEmitted?: boolean;
};

const DEFAULT_FREE_CAP = Number.parseInt(process.env.TOKEN_CAP_FREE ?? '7500', 10);
const DEFAULT_PRO_CAP = Number.parseInt(process.env.TOKEN_CAP_PRO ?? '100000', 10);

const planCaps: Record<string, number> = {
  FREE: DEFAULT_FREE_CAP,
  PRO: DEFAULT_PRO_CAP
};

const emitter = new EventEmitter();

const initialPlan = (process.env.PLAN ?? 'FREE').toUpperCase();

const initialState: InternalState = {
  used: 0,
  cap: resolveCap(initialPlan),
  plan: initialPlan,
  isOverCap: false
};

let state: InternalState = { ...initialState };

void loadBudgetState()
  .then((persisted) => {
    if (!persisted) {
      return;
    }
    const plan = (persisted.plan ?? initialPlan).toUpperCase();
    const cap = persisted.cap ?? resolveCap(plan);
    const used = Number.isFinite(persisted.used) ? persisted.used : 0;
    state = {
      used,
      cap,
      plan,
      isOverCap: used >= cap,
      lastPersisted: Date.now(),
      overCapEmitted: used >= cap
    };
    notifyChange();
  })
  .catch((error) => {
    mainError('budget:loadFailed', error instanceof Error ? error.message : String(error));
  });

function resolveCap(plan: string): number {
  const normalized = plan?.toUpperCase?.() ?? '';
  if (Number.isFinite(planCaps[normalized])) {
    return planCaps[normalized]!;
  }
  const fallback = Number.parseInt(process.env.TOKEN_CAP_DEFAULT ?? '7500', 10);
  return Number.isFinite(fallback) ? fallback : DEFAULT_FREE_CAP;
}

function computeIsOverCap(nextUsed: number, cap: number): boolean {
  if (!Number.isFinite(cap) || cap <= 0) {
    return false;
  }
  return nextUsed >= cap;
}

function persistState(next: InternalState): void {
  state = {
    ...next,
    overCapEmitted: next.isOverCap ? next.overCapEmitted : false
  };
  const toPersist = {
    used: state.used,
    cap: state.cap,
    plan: state.plan,
    lastUpdatedAt: Date.now()
  };
  void saveBudgetState(toPersist).catch((error) => {
    mainError(
      'budget:saveFailed',
      error instanceof Error ? error.message : String(error)
    );
  });
  notifyChange();
}

function notifyChange(): void {
  emitter.emit('changed', getBudgetState());
  broadcastToRenderers('budget:changed', getBudgetState());
}

export function getBudgetState(): BudgetState {
  return {
    used: state.used,
    cap: state.cap,
    isOverCap: state.isOverCap,
    plan: state.plan
  };
}

function updateUsage(nextUsed: number): void {
  const isOverCap = computeIsOverCap(nextUsed, state.cap);
  const nextState: InternalState = {
    ...state,
    used: nextUsed,
    isOverCap
  };

  const transitioned = !state.isOverCap && isOverCap;
  persistState(nextState);
  if (transitioned && !state.overCapEmitted) {
    state.overCapEmitted = true;
    trackTokenBudgetOverCap(state);
    emitter.emit('over-cap', getBudgetState());
    broadcastToRenderers('budget:blocked', getBudgetState());
  }
}

export function incrementUsage(delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) {
    return;
  }
  updateUsage(state.used + delta);
}

export function decrementUsage(delta: number): void {
  if (!Number.isFinite(delta) || delta <= 0) {
    return;
  }
  const nextUsed = Math.max(0, state.used - delta);
  updateUsage(nextUsed);
}

export function setCap(cap: number): void {
  if (!Number.isFinite(cap) || cap <= 0) {
    return;
  }
  const nextUsed = state.used;
  const isOverCap = computeIsOverCap(nextUsed, cap);
  const nextState: InternalState = {
    ...state,
    cap,
    isOverCap
  };
  persistState(nextState);
}

export function setPlan(plan: BudgetPlan): void {
  const normalized = plan?.toString?.().toUpperCase?.() ?? 'FREE';
  const cap = resolveCap(normalized);
  const nextState: InternalState = {
    ...state,
    plan: normalized,
    cap,
    isOverCap: computeIsOverCap(state.used, cap)
  };
  persistState(nextState);
}

export function resetBudget(): void {
  state = {
    used: 0,
    cap: resolveCap(state.plan),
    plan: state.plan,
    isOverCap: false,
    overCapEmitted: false
  };
  void resetBudgetState().catch((error) => {
    mainError('budget:resetFailed', error instanceof Error ? error.message : String(error));
  });
  notifyChange();
}

export function onBudgetChanged(listener: (state: BudgetState) => void): () => void {
  emitter.on('changed', listener);
  return () => emitter.off('changed', listener);
}

export function onBudgetOverCap(listener: (state: BudgetState) => void): () => void {
  emitter.on('over-cap', listener);
  return () => emitter.off('over-cap', listener);
}

function broadcastToRenderers(channel: string, payload: unknown): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, payload);
  });
}
