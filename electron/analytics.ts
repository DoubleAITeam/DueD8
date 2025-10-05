import { mainAnalytics } from './logger';
import type {
  BudgetSnapshotInput,
  TokenBudgetAnalyticsEventName
} from '../src/shared/analytics';
import { mergeSnapshot } from '../src/shared/analytics';

function emit(event: TokenBudgetAnalyticsEventName, snapshot: BudgetSnapshotInput, extra?: Record<string, unknown>): void {
  const payload = mergeSnapshot(snapshot, extra);
  mainAnalytics(event, payload);
}

export function trackTokenBudgetOverCap(snapshot: BudgetSnapshotInput): void {
  emit('token_budget/over_cap', snapshot);
}

export function trackTokenBudgetActionBlocked(
  entrypoint: string,
  snapshot: BudgetSnapshotInput
): void {
  emit('token_budget/action_blocked', snapshot, { entrypoint, source: 'main' });
}
