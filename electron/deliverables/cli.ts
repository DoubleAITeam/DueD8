import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { app } from 'electron';
import { runDeliverablePipeline } from './pipeline';
import { getRun, getRuns, saveSummary } from './dataStore';
import { buildRunSummary } from './summary';
import { buildBaseInsights } from './insights/build';
import { zipRun } from './archive';
import { sweepOldOutputs, type RetentionConfig } from './retention';
import { resetRules as resetPostRules } from './postprocess/config';
import type { ArtifactInput } from './types';

const CHILD_FLAG = 'DELIVERABLES_CLI_CHILD';

function resolveProjectRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

async function loadJsonFile<T>(candidate: string): Promise<T> {
  const resolved = path.resolve(candidate);
  const raw = await fs.readFile(resolved, 'utf8');
  return JSON.parse(raw) as T;
}

async function loadArtifacts(manifestPath?: string): Promise<ArtifactInput[]> {
  if (!manifestPath) {
    return [];
  }

  const parsed = await loadJsonFile<unknown>(manifestPath);
  if (!Array.isArray(parsed)) {
    throw new Error('Artifact manifest must be a JSON array.');
  }

  const artifacts: ArtifactInput[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const candidate = entry as Partial<ArtifactInput> & Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.srcPath !== 'string' || typeof candidate.type !== 'string') {
      continue;
    }
    artifacts.push({ id: candidate.id, srcPath: path.resolve(candidate.srcPath), type: candidate.type as ArtifactInput['type'] });
  }
  return artifacts;
}

async function loadCourseContext(contextPath?: string): Promise<Record<string, unknown> | undefined> {
  if (!contextPath) {
    return undefined;
  }
  const parsed = await loadJsonFile<unknown>(contextPath);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Post-processing context must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function printRunList(runs: Awaited<ReturnType<typeof getRuns>>): void {
  if (runs.length === 0) {
    console.log('No runs recorded.');
    return;
  }
  console.log('Available runs (newest first):');
  for (const run of runs) {
    const started = new Date(run.startedAt).toISOString();
    console.log(`- ${run.runId} (started ${started}, artifacts: ${run.results.length})`);
  }
}

async function handleRunCommand(args: string[]): Promise<number> {
  let artifactsPath: string | undefined;
  let dryRun = false;
  let concurrency: number | undefined;
  let postEnable: boolean | undefined;
  let postDryRun = false;
  let postContextPath: string | undefined;
  let resetRules = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case '--artifacts':
        artifactsPath = args[i + 1];
        i += 1;
        break;
      case '--dry-run':
        dryRun = true;
        break;
      case '--concurrency': {
        const next = args[i + 1];
        if (!next) {
          throw new Error('--concurrency expects a numeric value.');
        }
        concurrency = Number.parseInt(next, 10);
        if (!Number.isFinite(concurrency) || concurrency <= 0) {
          throw new Error('--concurrency must be a positive integer.');
        }
        i += 1;
        break;
      }
      case '--post': {
        const next = args[i + 1];
        if (!next) {
          throw new Error('--post expects "enable" or "disable".');
        }
        if (next === 'enable') {
          postEnable = true;
        } else if (next === 'disable') {
          postEnable = false;
        } else {
          throw new Error('--post expects "enable" or "disable".');
        }
        i += 1;
        break;
      }
      case '--post-dry-run':
        postDryRun = true;
        break;
      case '--ctx':
        postContextPath = args[i + 1];
        i += 1;
        break;
      case '--reset-rules':
        resetRules = true;
        break;
      case '--help':
        console.log('Usage: deliverables run [--artifacts manifest.json] [--dry-run] [--concurrency N] [--post enable|disable] [--post-dry-run] [--ctx ctx.json] [--reset-rules]');
        return 0;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option for run command: ${arg}`);
        }
    }
  }

  if (resetRules) {
    await resetPostRules();
    console.log('Post-processing rules reset to defaults.');
  }

  const artifacts = await loadArtifacts(artifactsPath);
  const ctx = await loadCourseContext(postContextPath);

  const options: {
    dryRun?: boolean;
    concurrency?: number;
    post?: { enable?: boolean; dryRun?: boolean; ctx?: Record<string, unknown> };
  } = {};

  if (dryRun) {
    options.dryRun = true;
  }
  if (typeof concurrency === 'number') {
    options.concurrency = concurrency;
  }
  const postOptions: { enable?: boolean; dryRun?: boolean; ctx?: Record<string, unknown> } = {};
  if (postEnable !== undefined) {
    postOptions.enable = postEnable;
  }
  if (postDryRun) {
    postOptions.dryRun = true;
  }
  if (ctx) {
    postOptions.ctx = ctx;
  }
  if (Object.keys(postOptions).length > 0) {
    options.post = postOptions;
  }

  const result = await runDeliverablePipeline(artifacts, options);
  console.log(JSON.stringify({ success: result.success, runId: result.run.runId, artifactsProcessed: result.run.results.length }, null, 2));
  return result.success ? 0 : 1;
}

async function resolveRunIdFromArgs(args: string[]): Promise<{ runId: string | null; listOnly: boolean; latest: boolean }> {
  let runId: string | null = null;
  let listOnly = false;
  let latest = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run') {
      runId = args[i + 1] ?? null;
      i += 1;
    } else if (arg === '--latest') {
      latest = true;
    } else if (arg === '--list') {
      listOnly = true;
    } else if (arg === '--help') {
      console.log('Usage: deliverables summary [--run <runId>] [--latest] [--list]');
      return { runId: null, listOnly: true, latest: false };
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { runId, listOnly, latest };
}

async function handleSummaryCommand(args: string[]): Promise<number> {
  const { runId, listOnly, latest } = await resolveRunIdFromArgs(args);

  if (listOnly) {
    const runs = await getRuns();
    printRunList(runs);
    return 0;
  }

  let targetRunId = runId;
  if (!targetRunId && latest) {
    const [latestRun] = await getRuns(1);
    targetRunId = latestRun?.runId ?? null;
  }

  if (!targetRunId) {
    throw new Error('No run selected. Provide --run <runId> or --latest.');
  }

  const run = await getRun(targetRunId);
  if (!run) {
    throw new Error(`Run not found: ${targetRunId}`);
  }

  const summary = buildRunSummary(run);
  await saveSummary(run.runId, summary);
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

async function handleInsightsCommand(args: string[]): Promise<number> {
  let runId: string | null = null;
  let limit: number | undefined;
  let latest = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run') {
      runId = args[i + 1] ?? null;
      i += 1;
    } else if (arg === '--limit') {
      const next = args[i + 1];
      if (!next) {
        throw new Error('--limit expects a positive integer.');
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--limit expects a positive integer.');
      }
      limit = parsed;
      i += 1;
    } else if (arg === '--latest') {
      latest = true;
    } else if (arg === '--help') {
      console.log('Usage: deliverables insights [--run <runId>] [--latest] [--limit N]');
      return 0;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  let targetRunId = runId;
  if (!targetRunId && latest) {
    const [latestRun] = await getRuns(1);
    targetRunId = latestRun?.runId ?? null;
  }

  if (!targetRunId) {
    throw new Error('No run selected. Provide --run <runId> or --latest.');
  }

  const run = await getRun(targetRunId);
  if (!run) {
    throw new Error(`Run not found: ${targetRunId}`);
  }

  const bundle = await buildBaseInsights(run, { limit });
  console.log(JSON.stringify({ runId: bundle.runId, artifacts: Object.keys(bundle.base).length, path: path.join(app.getPath('userData'), 'deliverables', 'insights', `${bundle.runId}.json`) }, null, 2));
  return 0;
}

async function handleArchiveCommand(args: string[]): Promise<number> {
  let runId: string | null = null;
  let latest = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--run') {
      runId = args[i + 1] ?? null;
      i += 1;
    } else if (arg === '--latest') {
      latest = true;
    } else if (arg === '--help') {
      console.log('Usage: deliverables archive [--run <runId>] [--latest]');
      return 0;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  let targetRunId = runId;
  if (!targetRunId && latest) {
    const [latestRun] = await getRuns(1);
    targetRunId = latestRun?.runId ?? null;
  }

  if (!targetRunId) {
    throw new Error('No run selected. Provide --run <runId> or --latest.');
  }

  const outcome = await zipRun(targetRunId);
  if (!outcome.ok) {
    console.error(outcome.message ?? 'Archive creation failed.');
    return 1;
  }

  console.log(JSON.stringify({ runId: targetRunId, archivePath: outcome.archivePath ?? null }, null, 2));
  return 0;
}

async function handleSweepCommand(args: string[]): Promise<number> {
  const config: RetentionConfig = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--days') {
      const next = args[i + 1];
      if (!next) {
        throw new Error('--days expects a non-negative integer.');
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('--days expects a non-negative integer.');
      }
      config.keepDays = parsed;
      i += 1;
    } else if (arg === '--max-archives') {
      const next = args[i + 1];
      if (!next) {
        throw new Error('--max-archives expects a non-negative integer.');
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error('--max-archives expects a non-negative integer.');
      }
      config.maxArchives = parsed;
      i += 1;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--help') {
      console.log('Usage: deliverables sweep [--days N] [--max-archives N] [--dry-run]');
      return 0;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  const result = await sweepOldOutputs(config);
  const summary = {
    removed: result.removed.length,
    kept: result.kept.length,
    errors: result.errors,
    dryRun: Boolean(config.dryRun)
  };
  console.log(JSON.stringify(summary, null, 2));
  return result.errors.length > 0 ? 1 : 0;
}

async function runInsideElectron(args: string[]): Promise<number> {
  app.commandLine.appendSwitch('headless');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.disableHardwareAcceleration();

  const userDataOverride = process.env.DELIVERABLES_USER_DATA;
  if (userDataOverride) {
    app.setPath('userData', path.resolve(userDataOverride));
  }

  await app.whenReady();

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'run':
        return await handleRunCommand(commandArgs);
      case 'summary':
        return await handleSummaryCommand(commandArgs);
      case 'insights':
        return await handleInsightsCommand(commandArgs);
      case 'archive':
        return await handleArchiveCommand(commandArgs);
      case 'sweep':
        return await handleSweepCommand(commandArgs);
      case '--help':
      case '-h':
      case undefined:
        console.log('Usage: deliverables <run|summary|insights|archive|sweep> [options]');
        return 0;
      default:
        console.error(`Unknown command: ${command}`);
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  } finally {
    await app.quit();
  }
}

export function runCLI(rawArgs: string[]): Promise<number> {
  if (!process.versions.electron || process.env[CHILD_FLAG] !== '1') {
    const electronPath = require('electron') as unknown as string;
    return new Promise<number>((resolve, reject) => {
      const child = spawn(electronPath, [path.join(resolveProjectRoot(), 'bin', 'deliverables.js'), ...rawArgs], {
        stdio: 'inherit',
        env: { ...process.env, [CHILD_FLAG]: '1' }
      });
      child.on('error', (error) => {
        reject(error);
      });
      child.on('exit', (code) => {
        resolve(code ?? 0);
      });
    });
  }

  return runInsideElectron(rawArgs);
}
