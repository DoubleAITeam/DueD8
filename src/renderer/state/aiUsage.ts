import { create } from 'zustand';

const DEFAULT_FREE_LIMIT = 7500;
const DEFAULT_PREMIUM_LIMIT = 50000;
const WARNING_THRESHOLD = 0.8;
const AVG_CHARS_PER_TOKEN = 4;

export type AiTaskCategory = 'parse' | 'generate' | 'summarize' | 'chat' | 'transcribe' | 'analyze';

export type AiTaskStep = {
  label: string;
  tokenEstimate: number;
};

export type AiTask = {
  id: string;
  label: string;
  category: AiTaskCategory;
  isAI: true;
  tokenEstimate: number;
  steps: AiTaskStep[];
  startedAt: number;
  metadata?: Record<string, unknown>;
};

type AiUsageState = {
  limits: {
    free: number;
    premium: number;
  };
  warningThreshold: number;
  tasks: AiTask[];
  usageToday: number;
  registerTask: (options: {
    label: string;
    category: AiTaskCategory;
    steps?: AiTaskStep[];
    tokenEstimate?: number;
    metadata?: Record<string, unknown>;
    startedAt?: number;
  }) => AiTask;
  pruneOlderThan: (timestamp: number) => void;
  reset: () => void;
  setLimits: (limits: Partial<AiUsageState['limits']>) => void;
};

function createTaskId() {
  return `aitask-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function normaliseTokenValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value);
}

function calculateUsageForDay(tasks: AiTask[], reference = Date.now()) {
  const referenceDate = new Date(reference);
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDate = referenceDate.getDate();
  return tasks
    .filter((task) => {
      const when = new Date(task.startedAt);
      return when.getFullYear() === refYear && when.getMonth() === refMonth && when.getDate() === refDate;
    })
    .reduce((sum, task) => sum + task.tokenEstimate, 0);
}

export function estimateTokensFromText(text: string | null | undefined) {
  if (!text) {
    return 0;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  const estimate = trimmed.length / AVG_CHARS_PER_TOKEN;
  return normaliseTokenValue(Math.max(10, estimate));
}

export function estimateTokensFromTexts(inputs: Array<string | null | undefined>) {
  return normaliseTokenValue(inputs.reduce((sum, input) => sum + estimateTokensFromText(input), 0));
}

export function formatTokenEstimate(tokens: number | null | undefined) {
  if (!tokens || !Number.isFinite(tokens) || tokens <= 0) {
    return '0';
  }
  if (tokens >= 1000) {
    const value = tokens / 1000;
    const rounded = Math.round(value * 10) / 10;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
  }
  return Math.round(tokens).toLocaleString();
}

export const useAiUsageStore = create<AiUsageState>((set) => ({
  limits: {
    free: DEFAULT_FREE_LIMIT,
    premium: DEFAULT_PREMIUM_LIMIT
  },
  warningThreshold: WARNING_THRESHOLD,
  tasks: [],
  usageToday: 0,
  registerTask: ({ label, category, steps = [], tokenEstimate, metadata, startedAt }) => {
    const timestamp = startedAt ?? Date.now();
    const normalisedSteps = steps.map((step) => ({
      ...step,
      tokenEstimate: normaliseTokenValue(step.tokenEstimate)
    }));
    const stepsTotal = normalisedSteps.reduce((sum, step) => sum + step.tokenEstimate, 0);
    const providedTotal =
      typeof tokenEstimate === 'number' ? normaliseTokenValue(tokenEstimate) : undefined;
    const total = providedTotal ?? (normalisedSteps.length ? stepsTotal : 0);
    const ensuredSteps = normalisedSteps.length
      ? normalisedSteps
      : total
      ? [{ label: label || category, tokenEstimate: total }]
      : [];
    const task: AiTask = {
      id: createTaskId(),
      label,
      category,
      isAI: true,
      tokenEstimate: ensuredSteps.reduce((sum, step) => sum + step.tokenEstimate, 0),
      steps: ensuredSteps,
      startedAt: timestamp,
      metadata
    };

    set((state) => {
      const tasks = [task, ...state.tasks].slice(0, 200);
      return {
        tasks,
        usageToday: calculateUsageForDay(tasks, timestamp)
      };
    });

    return task;
  },
  pruneOlderThan: (timestamp) => {
    set((state) => {
      const tasks = state.tasks.filter((task) => task.startedAt >= timestamp);
      return {
        tasks,
        usageToday: calculateUsageForDay(tasks)
      };
    });
  },
  reset: () => set({ tasks: [], usageToday: 0 }),
  setLimits: (limits) =>
    set((state) => ({
      limits: {
        ...state.limits,
        ...limits
      }
    }))
}));

export function selectAiUsageSummary(state: ReturnType<typeof useAiUsageStore.getState>) {
  const { limits, warningThreshold, tasks, usageToday } = state;
  return {
    limits,
    warningThreshold,
    tasks,
    usageToday
  };
}
