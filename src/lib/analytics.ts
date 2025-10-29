import { rendererAnalytics } from './logger';
import type {
  BudgetSnapshotInput,
  TokenBudgetModalCTA,
  TokenBudgetAnalyticsEventName
} from '../shared/analytics';
import { mergeSnapshot } from '../shared/analytics';

export function logEvent(event: string, payload: Record<string, unknown> = {}): void {
  rendererAnalytics(event, payload);
}

function emit(
  event: TokenBudgetAnalyticsEventName,
  snapshot: BudgetSnapshotInput,
  extra?: Record<string, unknown>
): void {
  const payload = mergeSnapshot(snapshot, extra);
  logEvent(event, payload);
}

export function trackTokenBudgetModalView(snapshot: BudgetSnapshotInput): void {
  emit('token_budget.modal_view', snapshot);
}

export function trackTokenBudgetModalClick(
  snapshot: BudgetSnapshotInput,
  cta: TokenBudgetModalCTA
): void {
  emit('token_budget.modal_click', snapshot, { cta });
}

export function trackTokenBudgetActionBlocked(
  entrypoint: string,
  snapshot: BudgetSnapshotInput
): void {
  emit('token_budget.action_blocked', snapshot, { entrypoint, source: 'renderer' });
}
