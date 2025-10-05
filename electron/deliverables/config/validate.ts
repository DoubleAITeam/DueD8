type EnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;

type NumberParseMode = 'int' | 'float';

type IssueCode =
  | 'INVALID_NUMBER'
  | 'OUT_OF_RANGE'
  | 'INVALID_BOOLEAN'
  | 'INVALID_STRING';

export interface ConfigValidationIssue {
  code: IssueCode;
  field: string;
  message: string;
  value?: string;
}

export interface DeliverablesConfig {
  timeouts: {
    runMs: number;
    aiInsightsMs: number;
    aiSummaryMs: number;
  };
  sizeCaps: {
    maxArtifactMb: number;
  };
  concurrency: {
    maxParallelArtifacts: number;
  };
  retention: {
    days: number;
    protectRecentRuns: number;
    hardDelete: boolean;
    autoArchive: boolean;
  };
  logs: {
    memoryEntries: number;
  };
  featureFlags: {
    htmlPuppeteer: boolean;
    docxLibreoffice: boolean;
    pdfQpdf: boolean;
    aiSummary: boolean;
    aiInsights: boolean;
  };
  insights: {
    maxPages: number;
    maxBytesMb: number;
    maxBytes: number;
    redact: boolean;
    aiTimeoutMs: number;
  };
  ai: {
    openAiApiKey: string | null;
  };
  os: {
    allowExternalMove: boolean;
  };
  issues: ConfigValidationIssue[];
}

export interface ConfigValidationResult {
  config: DeliverablesConfig;
  issues: ConfigValidationIssue[];
}

const DEFAULTS = {
  timeouts: {
    runMs: 120_000,
    aiInsightsMs: 8_000,
    aiSummaryMs: 10_000
  },
  sizeCaps: {
    maxArtifactMb: 25
  },
  concurrency: {
    maxParallelArtifacts: 2
  },
  retention: {
    days: 30,
    protectRecentRuns: 3,
    hardDelete: false,
    autoArchive: false
  },
  logs: {
    memoryEntries: 200
  },
  insights: {
    maxPages: 50,
    maxBytesMb: 20,
    aiTimeoutMs: 8_000,
    redact: true
  },
  os: {
    allowExternalMove: false
  }
} as const;

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function normaliseKey(key: string): string {
  return key.trim().toUpperCase();
}

function coerceNumber(
  env: EnvSource,
  key: string,
  mode: NumberParseMode,
  fallback: number,
  issues: ConfigValidationIssue[],
  { min, max }: { min?: number; max?: number } = {}
): number {
  const raw = env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const parsed = mode === 'int' ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    issues.push({
      code: 'INVALID_NUMBER',
      field: normaliseKey(key),
      value: raw,
      message: `Expected a ${mode === 'int' ? 'whole number' : 'number'} for ${key}.`
    });
    return fallback;
  }

  let value = parsed;
  if (min !== undefined && value < min) {
    issues.push({
      code: 'OUT_OF_RANGE',
      field: normaliseKey(key),
      value: raw,
      message: `${key} below minimum of ${min}. Using clamped value.`
    });
    value = min;
  }

  if (max !== undefined && value > max) {
    issues.push({
      code: 'OUT_OF_RANGE',
      field: normaliseKey(key),
      value: raw,
      message: `${key} above maximum of ${max}. Using clamped value.`
    });
    value = max;
  }

  return value;
}

function coerceBoolean(env: EnvSource, key: string, fallback: boolean, issues: ConfigValidationIssue[]): boolean {
  const raw = env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const normalised = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(normalised)) {
    return true;
  }

  if (FALSE_VALUES.has(normalised)) {
    return false;
  }

  issues.push({
    code: 'INVALID_BOOLEAN',
    field: normaliseKey(key),
    value: raw,
    message: `Unrecognised boolean value for ${key}.`
  });
  return fallback;
}

function coerceString(
  env: EnvSource,
  key: string,
  fallback: string | null,
  issues: ConfigValidationIssue[],
  { allowEmpty = false, trim = true }: { allowEmpty?: boolean; trim?: boolean } = {}
): string | null {
  const raw = env[key];
  if (raw === undefined) {
    return fallback;
  }

  const value = trim ? raw.trim() : raw;
  if (!allowEmpty && value.length === 0) {
    issues.push({
      code: 'INVALID_STRING',
      field: normaliseKey(key),
      message: `${key} cannot be empty string.`
    });
    return fallback;
  }

  return value;
}

function resolveOpenAiKey(env: EnvSource, issues: ConfigValidationIssue[]): string | null {
  const explicit = coerceString(env, 'OPENAI_API_KEY', null, issues) ??
    coerceString(env, 'DELIV_OPENAI_API_KEY', null, issues);
  if (!explicit) {
    return null;
  }
  return explicit;
}

function buildFeatureFlags(env: EnvSource, issues: ConfigValidationIssue[]) {
  const htmlPuppeteer = coerceBoolean(env, 'DELIV_HTML_PUPPETEER', false, issues);
  const docxLibreoffice = coerceBoolean(env, 'DELIV_DOCX_LIBREOFFICE', false, issues);
  const pdfQpdf = coerceBoolean(env, 'DELIV_PDF_QPDF', false, issues);
  const aiSummary = coerceBoolean(env, 'DELIV_AI_SUMMARY', false, issues);
  const aiInsights = coerceBoolean(env, 'DELIV_AI_INSIGHTS', false, issues);
  return { htmlPuppeteer, docxLibreoffice, pdfQpdf, aiSummary, aiInsights };
}

export function loadConfig(env: EnvSource = process.env): ConfigValidationResult {
  const issues: ConfigValidationIssue[] = [];

  const maxArtifactMb = coerceNumber(env, 'DELIVERABLE_MAX_MB', 'float', DEFAULTS.sizeCaps.maxArtifactMb, issues, {
    min: 1,
    max: 5_000
  });

  const retentionDays = coerceNumber(env, 'DELIV_RETENTION_DAYS', 'int', DEFAULTS.retention.days, issues, {
    min: 0,
    max: 3_650
  });

  const protectRecentRuns = coerceNumber(
    env,
    'DELIV_PROTECT_RECENT_RUNS',
    'int',
    DEFAULTS.retention.protectRecentRuns,
    issues,
    { min: 0, max: 365 }
  );

  const runTimeout = coerceNumber(env, 'DELIV_TIMEOUT_MS', 'int', DEFAULTS.timeouts.runMs, issues, {
    min: 1_000,
    max: 3_600_000
  });

  const aiSummaryTimeout = coerceNumber(
    env,
    'DELIV_AI_SUMMARY_TIMEOUT_MS',
    'int',
    DEFAULTS.timeouts.aiSummaryMs,
    issues,
    { min: 1_000, max: 120_000 }
  );

  const aiInsightsTimeout = coerceNumber(
    env,
    'DELIV_AI_INSIGHTS_TIMEOUT_MS',
    'int',
    DEFAULTS.insights.aiTimeoutMs,
    issues,
    { min: 1_000, max: 120_000 }
  );

  const insightsMaxPages = coerceNumber(env, 'INSIGHTS_MAX_PAGES', 'int', DEFAULTS.insights.maxPages, issues, {
    min: 1,
    max: 10_000
  });

  const insightsMaxBytesMb = coerceNumber(
    env,
    'INSIGHTS_MAX_BYTES_MB',
    'float',
    DEFAULTS.insights.maxBytesMb,
    issues,
    { min: 1, max: 5_000 }
  );

  const concurrency = coerceNumber(
    env,
    'DELIV_MAX_PARALLEL_ARTIFACTS',
    'int',
    DEFAULTS.concurrency.maxParallelArtifacts,
    issues,
    { min: 1, max: 32 }
  );

  const logCap = coerceNumber(env, 'DELIV_LOG_MEMORY_CAP', 'int', DEFAULTS.logs.memoryEntries, issues, {
    min: 50,
    max: 10_000
  });

  const hardDelete = coerceBoolean(env, 'DELIV_HARD_DELETE', DEFAULTS.retention.hardDelete, issues);
  const autoArchive = coerceBoolean(env, 'DELIV_AUTO_ARCHIVE', DEFAULTS.retention.autoArchive, issues);
  const allowExternalMove = coerceBoolean(
    env,
    'DELIV_ALLOW_EXTERNAL_MOVE',
    DEFAULTS.os.allowExternalMove,
    issues
  );

  const featureFlags = buildFeatureFlags(env, issues);
  const redact = coerceBoolean(env, 'DELIV_INSIGHTS_REDACT', DEFAULTS.insights.redact, issues);

  const openAiApiKey = resolveOpenAiKey(env, issues);

  const config: DeliverablesConfig = {
    timeouts: {
      runMs: runTimeout,
      aiInsightsMs: aiInsightsTimeout,
      aiSummaryMs: aiSummaryTimeout
    },
    sizeCaps: {
      maxArtifactMb
    },
    concurrency: {
      maxParallelArtifacts: concurrency
    },
    retention: {
      days: retentionDays,
      protectRecentRuns,
      hardDelete,
      autoArchive
    },
    logs: {
      memoryEntries: logCap
    },
    featureFlags,
    insights: {
      maxPages: insightsMaxPages,
      maxBytesMb: insightsMaxBytesMb,
      maxBytes: insightsMaxBytesMb * 1024 * 1024,
      redact,
      aiTimeoutMs: aiInsightsTimeout
    },
    ai: {
      openAiApiKey
    },
    os: {
      allowExternalMove
    },
    issues
  };

  return { config, issues };
}
