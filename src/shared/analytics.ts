export type TokenBudgetAnalyticsEventName =
  | 'token_budget.over_cap'
  | 'token_budget.modal_view'
  | 'token_budget.modal_click'
  | 'token_budget.action_blocked';

export type AiAnalyticsEventName =
  | 'ai/turn_start'
  | 'ai/turn_final'
  | 'ai/tool_call';

export type AnalyticsEventName = TokenBudgetAnalyticsEventName | AiAnalyticsEventName;

export type TokenBudgetModalCTA = 'upgrade' | 'close';

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

export type AiTurnStartSnapshot = {
  chatId: string;
  messageId: string;
  model: string;
  mode: string;
};

export type AiTurnFinalSnapshot = AiTurnStartSnapshot & {
  latencyMs: number;
  usage?: { prompt?: number; completion?: number; total?: number };
};

export type AiToolCallSnapshot = {
  chatId: string;
  messageId: string;
  tool: string;
  latencyMs?: number;
};

export type TokenBudgetEventPayloads = {
  'token_budget.over_cap': BudgetSnapshot;
  'token_budget.modal_view': BudgetSnapshot & {
    source?: string;
  };
  'token_budget.modal_click': BudgetSnapshot & {
    source?: string;
    cta: TokenBudgetModalCTA;
  };
  'token_budget.action_blocked': BudgetSnapshot & {
    entrypoint?: string;
    feature?: string;
    source?: TokenBudgetActionSource;
  };
};

export type AiEventPayloads = {
  'ai/turn_start': AiTurnStartSnapshot;
  'ai/turn_final': AiTurnFinalSnapshot;
  'ai/tool_call': AiToolCallSnapshot;
};

export type AnalyticsEventPayloads = TokenBudgetEventPayloads & AiEventPayloads;

export type AnalyticsPayload<Name extends AnalyticsEventName> = AnalyticsEventPayloads[Name];

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

export function mergeSnapshot<T extends Record<string, unknown> = Record<string, unknown>>(
  input: BudgetSnapshotInput,
  extra: T = {} as T
): BudgetSnapshot & T {
  return {
    ...toBudgetSnapshot(input),
    ...extra
  };
}
