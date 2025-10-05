import { ipcMain } from 'electron';
import { runDeliverablePipeline } from './pipeline';
import { getRun, getRuns, getSummary, resetRuns, saveSummary } from './dataStore';
import type { ArtifactInput } from './types';
import { getAdapterOverview } from './renderers/registry';
import { getLogs } from './logStore';
import { buildRunSummary } from './summary';
import { writeRunReport } from './report';
import { buildAiSummary } from './aiSummary';
import { getRules, resetRules as resetPostRules, setRules } from './postprocess/config';
import type { CourseContext, Rule } from './postprocess/types';
import { revealInFolder, openPath, moveToTrash } from './osActions';
import { zipRun, zipArtifacts } from './archive';
import { sweepOldOutputs, type RetentionConfig } from './retention';
import {
  buildBaseInsights,
  buildAiInsights,
  loadInsightBundle,
  saveInsightCorrection,
  isAiInsightsAvailable,
  getRedactionInfo
} from './insights/build';

function normalizeCourseContext(raw: unknown): CourseContext | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const ctx = raw as CourseContext;
  const normalized: CourseContext = {};
  if (typeof ctx.courseId === 'string' && ctx.courseId.trim()) {
    normalized.courseId = ctx.courseId.trim();
  }
  if (typeof ctx.courseName === 'string' && ctx.courseName.trim()) {
    normalized.courseName = ctx.courseName.trim();
  }
  if (typeof ctx.assignmentId === 'string' && ctx.assignmentId.trim()) {
    normalized.assignmentId = ctx.assignmentId.trim();
  }
  if (typeof ctx.dueDateIso === 'string' && ctx.dueDateIso.trim()) {
    normalized.dueDateIso = ctx.dueDateIso.trim();
  }
  if (ctx.meta && typeof ctx.meta === 'object') {
    const entries = Object.entries(ctx.meta).filter(([, value]) => {
      const valueType = typeof value;
      return valueType === 'string' || valueType === 'number' || valueType === 'boolean';
    }) as Array<[string, string | number | boolean]>;
    if (entries.length > 0) {
      normalized.meta = Object.fromEntries(entries);
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizePostOptions(
  raw: unknown
): { enable?: boolean; dryRun?: boolean; ctx?: CourseContext } | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const input = raw as { enable?: unknown; dryRun?: unknown; ctx?: unknown };
  const normalized: { enable?: boolean; dryRun?: boolean; ctx?: CourseContext } = {};

  if (typeof input.enable !== 'undefined') {
    normalized.enable = Boolean(input.enable);
  }
  if (typeof input.dryRun !== 'undefined') {
    normalized.dryRun = Boolean(input.dryRun);
  }

  const ctx = normalizeCourseContext(input.ctx);
  if (ctx) {
    normalized.ctx = ctx;
  }

  return Object.keys(normalized).length > 0 ? normalized : {};
}

function normalizePipelineOptions(options: unknown):
  | { concurrency?: number; dryRun: boolean; post?: { enable?: boolean; dryRun?: boolean; ctx?: CourseContext } }
  | undefined {
  if (!options || typeof options !== 'object') {
    return undefined;
  }

  const input = options as { concurrency?: unknown; dryRun?: unknown; post?: unknown };
  const normalized: {
    concurrency?: number;
    dryRun: boolean;
    post?: { enable?: boolean; dryRun?: boolean; ctx?: CourseContext };
  } = {
    dryRun: Boolean(input.dryRun)
  };

  if (typeof input.concurrency === 'number') {
    normalized.concurrency = input.concurrency;
  }

  const post = normalizePostOptions(input.post);
  if (post) {
    normalized.post = post;
  }

  return normalized;
}

ipcMain.handle(
  'runDeliverablesPipeline',
  async (_event, artifacts: ArtifactInput[] = [], options?: unknown) => {
    const normalizedArtifacts = Array.isArray(artifacts) ? artifacts : [];
    const normalizedOptions = normalizePipelineOptions(options);
    return runDeliverablePipeline(normalizedArtifacts, normalizedOptions);
  }
);

ipcMain.handle(
  'deliverables:runWithPost',
  async (_event, artifacts: ArtifactInput[] = [], options?: unknown) => {
    const normalizedArtifacts = Array.isArray(artifacts) ? artifacts : [];
    const normalizedOptions = normalizePipelineOptions(options);
    return runDeliverablePipeline(normalizedArtifacts, normalizedOptions);
  }
);

ipcMain.handle('deliverables:getRules', async () => {
  return getRules();
});

ipcMain.handle('deliverables:setRules', async (_event, rules: unknown) => {
  try {
    if (!Array.isArray(rules)) {
      throw new Error('Rules must be an array.');
    }
    await setRules(rules as Rule[]);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to persist rules.';
    console.error('[deliverables:ipc] Failed to persist rules', error);
    return { ok: false, message };
  }
});

ipcMain.handle('deliverables:resetRules', async () => {
  await resetPostRules();
  return getRules();
});

ipcMain.handle('deliverables:getAdapterHealth', async () => {
  return getAdapterOverview();
});

ipcMain.handle('deliverables:getLogs', async () => {
  return getLogs();
});

ipcMain.handle('deliverables:getSummary', async (_event, runId: string) => {
  if (typeof runId !== 'string' || runId.length === 0) {
    return null;
  }
  return getSummary(runId);
});

ipcMain.handle('deliverables:rebuildSummary', async (_event, runId: string) => {
  if (typeof runId !== 'string' || runId.length === 0) {
    return null;
  }
  const run = await getRun(runId);
  if (!run) {
    return null;
  }
  const base = buildRunSummary(run);
  await saveSummary(runId, base);
  return base;
});

ipcMain.handle('deliverables:exportReport', async (_event, runId: string, format?: 'html' | 'json') => {
  if (typeof runId !== 'string' || runId.length === 0) {
    return '';
  }
  const run = await getRun(runId);
  if (!run) {
    return '';
  }
  const summary = (await getSummary(runId)) ?? buildRunSummary(run);
  return writeRunReport(run, summary, { format });
});

ipcMain.handle('deliverables:getAiSummary', async (_event, runId: string) => {
  if (typeof runId !== 'string' || runId.length === 0) {
    return null;
  }
  const run = await getRun(runId);
  if (!run) {
    return null;
  }
  const base = (await getSummary(runId)) ?? buildRunSummary(run);
  return buildAiSummary(run, base);
});

ipcMain.handle(
  'deliverables:getInsights',
  async (_event, runId: string): Promise<Awaited<ReturnType<typeof loadInsightBundle>>> => {
    if (typeof runId !== 'string' || runId.length === 0) {
      return null;
    }
    return loadInsightBundle(runId);
  }
);

ipcMain.handle(
  'deliverables:buildBaseInsights',
  async (_event, runId: string, options?: { limit?: number }) => {
    if (typeof runId !== 'string' || runId.length === 0) {
      return null;
    }
    const run = await getRun(runId);
    if (!run) {
      return null;
    }
    try {
      return await buildBaseInsights(run, { limit: options?.limit });
    } catch (error) {
      console.error('[deliverables:ipc] Failed to build base insights', error);
      return null;
    }
  }
);

ipcMain.handle(
  'deliverables:buildAiInsights',
  async (_event, runId: string) => {
    if (typeof runId !== 'string' || runId.length === 0) {
      return null;
    }
    const bundle = await loadInsightBundle(runId);
    if (!bundle) {
      return null;
    }
    try {
      return await buildAiInsights(runId, bundle);
    } catch (error) {
      console.error('[deliverables:ipc] Failed to build AI insights', error);
      return bundle;
    }
  }
);

ipcMain.handle(
  'deliverables:saveInsightCorrection',
  async (
    _event,
    runId: string,
    artifactId: string,
    patch: { title?: string; detectedCourseId?: string; detectedAssignmentId?: string }
  ) => {
    if (typeof runId !== 'string' || typeof artifactId !== 'string' || artifactId.length === 0) {
      return null;
    }
    try {
      return await saveInsightCorrection(runId, artifactId, patch ?? {});
    } catch (error) {
      console.error('[deliverables:ipc] Failed to save insight correction', error);
      return null;
    }
  }
);

ipcMain.handle('deliverables:isAiInsightsEnabled', async () => {
  return isAiInsightsAvailable();
});

ipcMain.handle('deliverables:getInsightRedactionInfo', async () => {
  return getRedactionInfo();
});

function normalizeRetentionConfig(raw: unknown): RetentionConfig | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const input = raw as { keepDays?: unknown; maxArchives?: unknown; dryRun?: unknown };
  const config: RetentionConfig = {};

  const parseNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };

  const keepDays = parseNumber(input.keepDays);
  if (typeof keepDays === 'number') {
    config.keepDays = keepDays;
  }

  const maxArchives = parseNumber(input.maxArchives);
  if (typeof maxArchives === 'number') {
    config.maxArchives = maxArchives;
  }

  if (typeof input.dryRun !== 'undefined') {
    config.dryRun = Boolean(input.dryRun);
  }

  return config;
}

ipcMain.handle('deliverables:revealInFolder', async (_event, targetPath: unknown) => {
  if (typeof targetPath !== 'string') {
    return false;
  }
  return revealInFolder(targetPath);
});

ipcMain.handle('deliverables:openPath', async (_event, targetPath: unknown) => {
  if (typeof targetPath !== 'string') {
    return { ok: false, message: 'Path is required.' };
  }
  return openPath(targetPath);
});

ipcMain.handle('deliverables:moveToTrash', async (_event, targetPath: unknown) => {
  if (typeof targetPath !== 'string') {
    return { ok: false, message: 'Path is required.' };
  }
  return moveToTrash(targetPath);
});

ipcMain.handle('deliverables:zipRun', async (_event, runId: unknown) => {
  if (typeof runId !== 'string' || runId.length === 0) {
    return { ok: false, message: 'Run ID is required.' };
  }
  return zipRun(runId);
});

ipcMain.handle('deliverables:zipArtifacts', async (_event, runId: unknown, artifactIds?: unknown) => {
  if (typeof runId !== 'string' || runId.length === 0) {
    return { ok: false, message: 'Run ID is required.' };
  }
  const ids = Array.isArray(artifactIds)
    ? artifactIds.filter((value): value is string => typeof value === 'string')
    : [];
  return zipArtifacts(ids, runId);
});

ipcMain.handle('deliverables:sweepOldOutputs', async (_event, rawConfig?: unknown) => {
  const config = normalizeRetentionConfig(rawConfig);
  return sweepOldOutputs(config);
});

if (process.env.NODE_ENV !== 'production') {
  ipcMain.handle('deliverables:getRuns', async (_event, limit?: number) => {
    return getRuns(limit);
  });

  ipcMain.handle('deliverables:resetRuns', async () => {
    await resetRuns();
    return true;
  });
}
