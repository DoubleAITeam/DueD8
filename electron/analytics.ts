import { mainAnalytics } from './logger';
import type {
  AiAnalyticsEventName,
  AiEventPayloads,
  AiToolCallSnapshot,
  AiTurnFinalSnapshot,
  AiTurnStartSnapshot,
  BudgetSnapshot,
  BudgetSnapshotInput,
  TokenBudgetAnalyticsEventName,
  TokenBudgetEventPayloads
} from '../src/shared/analytics';
import { mergeSnapshot } from '../src/shared/analytics';

type TokenBudgetEventExtras<Name extends TokenBudgetAnalyticsEventName> = Omit<
  TokenBudgetEventPayloads[Name],
  keyof BudgetSnapshot
>;

function emitTokenBudget<Name extends TokenBudgetAnalyticsEventName>(
  event: Name,
  snapshot: BudgetSnapshotInput,
  extra?: TokenBudgetEventExtras<Name>
): void {
  const payload = mergeSnapshot(snapshot, extra ?? ({} as TokenBudgetEventExtras<Name>)) as TokenBudgetEventPayloads[Name];
  mainAnalytics(event, payload);
}

function emitAi<Name extends AiAnalyticsEventName>(
  event: Name,
  payload: AiEventPayloads[Name]
): void {
  mainAnalytics(event, payload);
}

export function trackTokenBudgetOverCap(snapshot: BudgetSnapshotInput): void {
  emitTokenBudget('token_budget.over_cap', snapshot);
}

export function trackTokenBudgetActionBlocked(
  entrypoint: string,
  snapshot: BudgetSnapshotInput
): void {
  emitTokenBudget('token_budget.action_blocked', snapshot, { entrypoint, source: 'main' });
}

export function trackAiTurnStart(snapshot: AiTurnStartSnapshot): void {
  emitAi('ai/turn_start', snapshot);
}

export function trackAiTurnFinal(snapshot: AiTurnFinalSnapshot): void {
  emitAi('ai/turn_final', snapshot);
}

export function trackAiToolCall(snapshot: AiToolCallSnapshot): void {
  emitAi('ai/tool_call', snapshot);
}
