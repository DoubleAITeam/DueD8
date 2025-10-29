import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMock = vi.hoisted(() => ({
  trackTokenBudgetActionBlocked: vi.fn()
}));

const bootstrapBudgetState = vi.fn();

vi.mock('../../src/lib/analytics', () => analyticsMock);

vi.mock('../../src/renderer/state/budget', async () => {
  const actual = await vi.importActual<typeof import('../../src/renderer/state/budget')>(
    '../../src/renderer/state/budget'
  );
  return {
    ...actual,
    bootstrapBudgetState
  };
});

let useBudgetStore: typeof import('../../src/renderer/state/budget').useBudgetStore;

type BudgetGetState = () => Promise<{
  used: number;
  cap: number;
  plan: string;
  isOverCap: boolean;
}>;

let getBudgetStateMock: ReturnType<typeof vi.fn<BudgetGetState>>;

beforeEach(async () => {
  vi.resetModules();
  bootstrapBudgetState.mockReset();
  bootstrapBudgetState.mockResolvedValue(undefined);
  analyticsMock.trackTokenBudgetActionBlocked.mockReset();

  getBudgetStateMock = vi.fn();

  window.dued8 = {
    ...(window.dued8 ?? {}),
    budget: {
      getState: getBudgetStateMock,
      setPlan: vi.fn(),
      setCap: vi.fn(),
      reset: vi.fn(),
      refreshPlan: vi.fn(),
      checkAndReserve: vi.fn(),
      release: vi.fn(),
      getProFeatures: vi.fn(),
      onChanged: vi.fn(),
      onBlocked: vi.fn()
    }
  } as typeof window.dued8;

  const budgetModule = await import('../../src/renderer/state/budget');
  useBudgetStore = budgetModule.useBudgetStore;
  useBudgetStore.setState({
    used: 0,
    cap: 100,
    plan: 'FREE',
    isOverCap: false,
    lastNotifiedAt: null,
    upgradeModalOpen: false,
    upgradeModalSource: null,
    upgradeModalUsage: null,
    upgradeModalLimit: null
  });
});

describe('withBudgetGate', () => {
  it('allows action when under cap', async () => {
    getBudgetStateMock.mockResolvedValue({ used: 10, cap: 100, plan: 'FREE', isOverCap: false });
    const action = vi.fn().mockResolvedValue('done');
    const { withBudgetGate } = await import('../../src/renderer/utils/withBudgetGate');
    const wrapped = withBudgetGate('renderer.test', action);

    await expect(wrapped()).resolves.toBe('done');
    expect(action).toHaveBeenCalledTimes(1);
    expect(analyticsMock.trackTokenBudgetActionBlocked).not.toHaveBeenCalled();
    expect(useBudgetStore.getState().upgradeModalOpen).toBe(false);
  });

  it('blocks immediately when over cap', async () => {
    getBudgetStateMock.mockResolvedValue({ used: 120, cap: 100, plan: 'FREE', isOverCap: true });
    const action = vi.fn();
    const { withBudgetGate } = await import('../../src/renderer/utils/withBudgetGate');
    const wrapped = withBudgetGate('renderer.over', action);

    await expect(wrapped()).rejects.toMatchObject({ code: 'E_BUDGET_EXCEEDED' });
    expect(action).not.toHaveBeenCalled();
    expect(analyticsMock.trackTokenBudgetActionBlocked).toHaveBeenCalledWith(
      'renderer.over',
      expect.objectContaining({ used: 120, cap: 100, plan: 'FREE' })
    );
    expect(useBudgetStore.getState().upgradeModalOpen).toBe(true);
  });

  it('handles mid-flight budget errors from main process', async () => {
    getBudgetStateMock.mockResolvedValue({ used: 40, cap: 100, plan: 'FREE', isOverCap: false });
    const error = Object.assign(new Error('blocked'), { code: 'E_BUDGET_EXCEEDED' });
    const action = vi.fn().mockRejectedValue(error);
    const { withBudgetGate } = await import('../../src/renderer/utils/withBudgetGate');
    const wrapped = withBudgetGate('renderer.midflight', action);

    await expect(wrapped()).rejects.toBe(error);
    expect(action).toHaveBeenCalledTimes(1);
    expect(analyticsMock.trackTokenBudgetActionBlocked).toHaveBeenCalledTimes(1);
    expect(useBudgetStore.getState().upgradeModalOpen).toBe(true);
  });
});
