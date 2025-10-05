import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBudgetState = vi.fn();
const mainWarn = vi.fn();
const analyticsMock = vi.hoisted(() => ({
  trackTokenBudgetActionBlocked: vi.fn()
}));

vi.mock('../../electron/tokenBudget', () => ({
  getBudgetState
}));

vi.mock('../../electron/logger', () => ({
  mainWarn
}));

vi.mock('../../electron/analytics', () => analyticsMock);

describe('budgetGate', () => {
  beforeEach(() => {
    vi.resetModules();
    getBudgetState.mockReset();
    mainWarn.mockReset();
    analyticsMock.trackTokenBudgetActionBlocked.mockReset();
  });

  it('allows execution when under cap', async () => {
    getBudgetState.mockReturnValue({ isOverCap: false, used: 25, cap: 100, plan: 'FREE' });
    const { assertBudgetAvailable } = await import('../../electron/guards/budgetGate');
    expect(() => assertBudgetAvailable('pipeline.run')).not.toThrow();
    expect(analyticsMock.trackTokenBudgetActionBlocked).not.toHaveBeenCalled();
    expect(mainWarn).not.toHaveBeenCalled();
  });

  it('throws and logs when over cap', async () => {
    getBudgetState.mockReturnValue({ isOverCap: true, used: 150, cap: 100, plan: 'FREE' });
    const { assertBudgetAvailable, BudgetExceededError } = await import(
      '../../electron/guards/budgetGate'
    );

    expect(() => assertBudgetAvailable('pipeline.run')).toThrow(BudgetExceededError);
    expect(analyticsMock.trackTokenBudgetActionBlocked).toHaveBeenCalledWith(
      'pipeline.run',
      expect.objectContaining({ used: 150, cap: 100, plan: 'FREE' })
    );
    expect(mainWarn).toHaveBeenCalledWith(
      'budget:blocked_attempt',
      expect.stringContaining('pipeline.run')
    );
  });
});
