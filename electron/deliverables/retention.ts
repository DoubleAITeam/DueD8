import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { moveToTrash } from './osActions';
import { getRuns } from './dataStore';
import { getProtectRecentRuns, getRetentionDays, isHardDeleteEnabled } from './config';

export interface RetentionConfig {
  keepDays?: number;
  maxArchives?: number;
  dryRun?: boolean;
}

type RetentionError = { path: string; message: string };

type SweepResult = { removed: string[]; kept: string[]; errors: RetentionError[] };
export type RetentionSweepResult = SweepResult;

const DAY_MS = 24 * 60 * 60 * 1000;

function outputsRoot(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'outputs');
}

function archivesRoot(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'archives');
}

async function listDirectory(directory: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function gatherRunDirectories(): Promise<Map<string, string[]>> {
  const base = outputsRoot();
  const runs = await getRuns();
  const knownRunIds = new Set(runs.map((run) => run.runId));
  const runMap = new Map<string, Set<string>>();

  function record(runId: string, dirPath: string) {
    const bucket = runMap.get(runId) ?? new Set<string>();
    bucket.add(path.resolve(dirPath));
    runMap.set(runId, bucket);
  }

  const topLevel = await listDirectory(base);
  for (const entry of topLevel) {
    if (!entry.isDirectory()) {
      continue;
    }
    const entryPath = path.join(base, entry.name);
    const childEntries = await listDirectory(entryPath);
    const hasSubdirectories = childEntries.some((child) => child.isDirectory());
    const isKnownRun = knownRunIds.has(entry.name);
    const treatAsArtifactContainer = hasSubdirectories && !isKnownRun;

    if (!hasSubdirectories || isKnownRun) {
      record(entry.name, entryPath);
    }

    if (!treatAsArtifactContainer) {
      continue;
    }

    for (const child of childEntries) {
      if (!child.isDirectory()) {
        continue;
      }
      record(child.name, path.join(entryPath, child.name));
    }
  }

  return new Map(Array.from(runMap.entries(), ([runId, paths]) => [runId, Array.from(paths.values())]));
}

function determineProtectedRuns(protectCount: number, runs: Awaited<ReturnType<typeof getRuns>>): Set<string> {
  if (protectCount <= 0) {
    return new Set();
  }
  const protectedRuns = new Set<string>();
  const counts = new Map<string, number>();

  for (const run of runs) {
    for (const result of run.results) {
      const current = counts.get(result.id) ?? 0;
      if (current >= protectCount) {
        continue;
      }
      counts.set(result.id, current + 1);
      protectedRuns.add(run.runId);
    }
  }

  return protectedRuns;
}

async function removePath(target: string, hardDelete: boolean, dryRun: boolean): Promise<{ ok: boolean; message?: string }> {
  if (dryRun) {
    return { ok: true };
  }

  if (hardDelete) {
    try {
      await fs.rm(target, { recursive: true, force: true });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete path.';
      return { ok: false, message };
    }
  }

  return moveToTrash(target);
}

async function applyArchiveLimit(
  maxArchives: number,
  hardDelete: boolean,
  dryRun: boolean,
  result: SweepResult
): Promise<void> {
  if (maxArchives <= 0) {
    return;
  }
  const base = archivesRoot();
  const entries = await listDirectory(base);
  const archiveFiles: Array<{ path: string; mtimeMs: number }> = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.zip')) {
      continue;
    }
    const fullPath = path.join(base, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      archiveFiles.push({ path: fullPath, mtimeMs: stat.mtimeMs });
    } catch {
      // ignore unreadable archives
    }
  }

  if (archiveFiles.length <= maxArchives) {
    for (const entry of archiveFiles) {
      result.kept.push(entry.path);
    }
    return;
  }

  const sorted = archiveFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const toKeep = sorted.slice(0, maxArchives);
  const toRemove = sorted.slice(maxArchives);

  for (const entry of toKeep) {
    result.kept.push(entry.path);
  }

  for (const entry of toRemove) {
    const removal = await removePath(entry.path, hardDelete, dryRun);
    if (removal.ok) {
      result.removed.push(entry.path);
    } else {
      result.errors.push({ path: entry.path, message: removal.message ?? 'Failed to remove archive.' });
      result.kept.push(entry.path);
    }
  }
}

export async function sweepOldOutputs(cfg?: RetentionConfig): Promise<SweepResult> {
  const runs = await getRuns();
  const keepDays = cfg?.keepDays ?? getRetentionDays();
  const maxArchives = cfg?.maxArchives ?? 50;
  const dryRun = Boolean(cfg?.dryRun);
  const protectCount = getProtectRecentRuns();
  const protectedRuns = determineProtectedRuns(protectCount, runs);
  const hardDelete = isHardDeleteEnabled();
  const cutoff = Date.now() - Math.max(0, keepDays) * DAY_MS;
  const runLookup = new Map(runs.map((run) => [run.runId, run]));

  const runDirectories = await gatherRunDirectories();
  const result: SweepResult = { removed: [], kept: [], errors: [] };

  for (const [runId, directories] of runDirectories.entries()) {
    const runRecord = runLookup.get(runId) ?? null;
    const runTimestamp = runRecord?.startedAt ?? runRecord?.finishedAt ?? null;
    for (const directory of directories) {
      let shouldRemove = false;

      if (protectedRuns.has(runId)) {
        shouldRemove = false;
      } else {
        let referenceTime = runTimestamp;
        if (!referenceTime) {
          try {
            const stat = await fs.stat(directory);
            referenceTime = stat.mtimeMs;
          } catch {
            referenceTime = Date.now();
          }
        }
        shouldRemove = referenceTime < cutoff;
      }

      if (!shouldRemove) {
        result.kept.push(directory);
        continue;
      }

      const removal = await removePath(directory, hardDelete, dryRun);
      if (removal.ok) {
        result.removed.push(directory);
      } else {
        result.errors.push({ path: directory, message: removal.message ?? 'Failed to remove output directory.' });
        result.kept.push(directory);
      }
    }
  }

  await applyArchiveLimit(maxArchives, hardDelete, dryRun, result);
  return result;
}
