export type TokenBudgetAnalyticsEventName =
  | 'token_budget/over_cap'
  | 'token_budget/modal_view'
  | 'token_budget/modal_click'
  | 'token_budget/action_blocked';

export type TokenBudgetModalCTA = 'see_plans' | 'already_upgraded';

export type TokenBudgetActionSource = 'main' | 'renderer';

export type BudgetSnapshot = {
  used: number;
  cap: number;
  plan: string;
};

export type BudgetSnapshotInput = {
  used?: number | null;
  cap?: number | null;
  plan?: string | null;
};

export function toBudgetSnapshot(input: BudgetSnapshotInput): BudgetSnapshot {
  const sanitizeNumber = (value: number | null | undefined): number => {
    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return Math.max(0, numeric);
  };

  const sanitizePlan = (plan: string | null | undefined): string => {
    if (typeof plan !== 'string') {
      return 'UNKNOWN';
    }
    const trimmed = plan.trim();
    return trimmed.length > 0 ? trimmed : 'UNKNOWN';
  };

  return {
    used: sanitizeNumber(input.used ?? 0),
    cap: sanitizeNumber(input.cap ?? 0),
    plan: sanitizePlan(input.plan ?? 'FREE')
  };
}

export function mergeSnapshot(
  input: BudgetSnapshotInput,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...toBudgetSnapshot(input),
    ...extra
  };
}
