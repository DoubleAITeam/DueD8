import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as tokenBudget from '../../electron/tokenBudget';
import { enforceHardStop } from '../../electron/guards/budgetGate';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('enforceHardStop', () => {
  it('allows when budget available', () => {
    vi.spyOn(tokenBudget, 'getBudgetState').mockReturnValue({
      used: 10,
      cap: 100,
      isOverCap: false,
      plan: 'FREE'
    });
    expect(enforceHardStop('test')).toBe(true);
  });

  it('blocks when over cap', () => {
    vi.spyOn(tokenBudget, 'getBudgetState').mockReturnValue({
      used: 200,
      cap: 100,
      isOverCap: true,
      plan: 'FREE'
    });
    expect(enforceHardStop('test')).toBe(false);
  });
});
