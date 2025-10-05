import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeliverableRunRecord, RunSummary } from './types';

type BudgetPersistedState = {
  used: number;
  cap: number;
  plan?: string;
  lastUpdatedAt?: number;
};

function resolveRunsFilePath(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'runs.json');
}

function resolveSummariesFilePath(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'runs.summary.json');
}

function resolveBudgetFilePath(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'budget.json');
}

async function ensureRunsDirectory(): Promise<void> {
  const dir = path.dirname(resolveRunsFilePath());
  await fs.mkdir(dir, { recursive: true });
}

async function ensureBudgetDirectory(): Promise<void> {
  const dir = path.dirname(resolveBudgetFilePath());
  await fs.mkdir(dir, { recursive: true });
}

async function readRunsFromDisk(): Promise<DeliverableRunRecord[]> {
  try {
    const filePath = resolveRunsFilePath();
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as DeliverableRunRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    console.error('[deliverables:dataStore] Failed to read runs file', error);
    return [];
  }
}

export async function saveRun(record: DeliverableRunRecord): Promise<void> {
  const runs = await readRunsFromDisk();
  runs.push(record);
  await ensureRunsDirectory();
  const filePath = resolveRunsFilePath();
  await fs.writeFile(filePath, JSON.stringify(runs, null, 2), 'utf-8');
}

async function readSummariesFromDisk(): Promise<Record<string, RunSummary>> {
  try {
    const filePath = resolveSummariesFilePath();
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, RunSummary>;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    console.error('[deliverables:dataStore] Failed to read summaries file', error);
    return {};
  }
}

export async function saveSummary(runId: string, summary: RunSummary): Promise<void> {
  if (!runId) {
    return;
  }
  const summaries = await readSummariesFromDisk();
  summaries[runId] = summary;
  await ensureRunsDirectory();
  const filePath = resolveSummariesFilePath();
  await fs.writeFile(filePath, JSON.stringify(summaries, null, 2), 'utf-8');
}

async function readBudgetFromDisk(): Promise<BudgetPersistedState | null> {
  try {
    const filePath = resolveBudgetFilePath();
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as BudgetPersistedState;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error('[deliverables:dataStore] Failed to read budget file', error);
    return null;
  }
}

export async function loadBudgetState(): Promise<BudgetPersistedState | null> {
  return readBudgetFromDisk();
}

export async function saveBudgetState(state: BudgetPersistedState): Promise<void> {
  await ensureBudgetDirectory();
  const filePath = resolveBudgetFilePath();
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

export async function resetBudgetState(): Promise<void> {
  try {
    const filePath = resolveBudgetFilePath();
    await fs.rm(filePath, { force: true });
  } catch (error) {
    console.error('[deliverables:dataStore] Failed to reset budget file', error);
  }
}

export async function getSummary(runId: string): Promise<RunSummary | null> {
  if (!runId) {
    return null;
  }
  const summaries = await readSummariesFromDisk();
  return summaries[runId] ?? null;
}

export async function getRuns(limit?: number): Promise<DeliverableRunRecord[]> {
  const runs = await readRunsFromDisk();
  const sorted = [...runs].sort((a, b) => b.startedAt - a.startedAt);
  if (typeof limit === 'number' && limit >= 0) {
    return sorted.slice(0, limit);
  }
  return sorted;
}

export async function getRun(runId: string): Promise<DeliverableRunRecord | null> {
  if (!runId) {
    return null;
  }
  const runs = await readRunsFromDisk();
  const match = runs.find((entry) => entry.runId === runId);
  return match ?? null;
}

export async function resetRuns(): Promise<void> {
  try {
    const filePath = resolveRunsFilePath();
    await fs.rm(filePath, { force: true });
  } catch (error) {
    console.error('[deliverables:dataStore] Failed to reset runs file', error);
  }

  try {
    const summaryPath = resolveSummariesFilePath();
    await fs.rm(summaryPath, { force: true });
  } catch (error) {
    console.error('[deliverables:dataStore] Failed to reset summaries file', error);
  }
}
