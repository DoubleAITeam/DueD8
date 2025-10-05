import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMock = vi.hoisted(() => ({
  trackTokenBudgetOverCap: vi.fn()
}));

const dataStoreMock = vi.hoisted(() => ({
  loadBudgetState: vi.fn().mockResolvedValue(null),
  saveBudgetState: vi.fn().mockResolvedValue(undefined),
  resetBudgetState: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => []
  }
}));

vi.mock('../../electron/analytics', () => analyticsMock);
vi.mock('../../electron/deliverables/dataStore', () => dataStoreMock);

async function loadModule() {
  const mod = await import('../../electron/tokenBudget');
  await Promise.resolve();
  return mod;
}

describe('tokenBudget', () => {
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.TOKEN_CAP_FREE = '100';
  process.env.TOKEN_CAP_PRO = '200';
  process.env.PLAN = 'FREE';
  dataStoreMock.loadBudgetState.mockResolvedValue(null);
  dataStoreMock.saveBudgetState.mockResolvedValue(undefined);
  dataStoreMock.resetBudgetState.mockResolvedValue(undefined);
  analyticsMock.trackTokenBudgetOverCap.mockReset();
});

  it('tracks usage increments and cap enforcement', async () => {
    const { getBudgetState, incrementUsage, setCap } = await loadModule();
    setCap(100);
    incrementUsage(25);
    expect(getBudgetState()).toMatchObject({ used: 25, cap: 100, isOverCap: false });

    incrementUsage(80);
    expect(getBudgetState()).toMatchObject({ used: 105, cap: 100, isOverCap: true });
  });

  it('updates plan and cap values', async () => {
    const { getBudgetState, setPlan, setCap, incrementUsage } = await loadModule();
    setCap(150);
    incrementUsage(50);
    setPlan('PRO');
    expect(getBudgetState()).toMatchObject({ plan: 'PRO', cap: 200, used: 50, isOverCap: false });

    incrementUsage(200);
    expect(getBudgetState().isOverCap).toBe(true);

    setPlan('FREE');
    expect(getBudgetState()).toMatchObject({ plan: 'FREE', cap: 100, used: 250, isOverCap: true });
  });

  it('only emits over-cap analytics once per session', async () => {
    const { incrementUsage, setCap } = await loadModule();
    setCap(50);

    incrementUsage(60);
    incrementUsage(10);

    expect(analyticsMock.trackTokenBudgetOverCap).toHaveBeenCalledTimes(1);
    expect(analyticsMock.trackTokenBudgetOverCap).toHaveBeenCalledWith(
      expect.objectContaining({ used: 60, cap: 50, plan: 'FREE' })
    );
  });
});
