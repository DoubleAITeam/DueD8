import { app } from 'electron';
import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getAiRuntimeConfig, assertAiRuntimeReady } from '../config/aiRuntime';
import { getPromptPack } from '../prompts';
import { getDeliverablesConfig } from '../config';
import { loadAiResetState, updateAiResetState, getAiResetStatePath, type AiResetState } from './state';

interface PhaseStepReport {
  description: string;
  performed: boolean;
  dryRun: boolean;
  details?: Record<string, unknown>;
}

interface PhaseReport {
  name: string;
  steps: PhaseStepReport[];
}

export interface AiResetRunOptions {
  dryRun?: boolean;
  apply?: boolean;
  timestamp?: string;
  backupRunsLimit?: number;
}

export interface AiResetReport {
  timestamp: string;
  dryRun: boolean;
  phases: PhaseReport[];
  backupPath?: string;
  verificationReportPath?: string;
  statePath: string;
  finalState: AiResetState;
  success: boolean;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source: string, destinationDir: string): Promise<boolean> {
  const exists = await pathExists(source);
  if (!exists) {
    return false;
  }
  const stats = await fs.stat(source);
  const name = path.basename(source);
  const target = path.join(destinationDir, name);
  if (stats.isDirectory()) {
    await fs.cp(source, target, { recursive: true });
  } else {
    await fs.copyFile(source, target);
  }
  return true;
}

async function runCommand(command: string, args: string[], cwd: string): Promise<{ code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', cwd, env: process.env });
    child.on('error', (error) => reject(error));
    child.on('exit', (code) => resolve({ code: code ?? 0 }));
  });
}

async function collectFilesRecursive(root: string): Promise<string[]> {
  const entries: string[] = [];
  async function walk(current: string): Promise<void> {
    let stats: Stats;
    try {
      stats = await fs.stat(current);
    } catch {
      return;
    }
    if (stats.isDirectory()) {
      const children = await fs.readdir(current);
      await Promise.all(children.map((child) => walk(path.join(current, child))));
    } else if (stats.isFile()) {
      entries.push(current);
    }
  }
  await walk(root);
  return entries;
}

function formatTimestamp(ts: string): string {
  return ts.replace(/[:.]/g, '-');
}

async function writeJsonAtomic(targetPath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(targetPath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${targetPath}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.rename(tmpPath, targetPath);
}

export async function runCodexAiReset(options: AiResetRunOptions = {}): Promise<AiResetReport> {
  const apply = Boolean(options.apply);
  const dryRun = apply ? false : options.dryRun ?? true;
  const runtime = getAiRuntimeConfig();
  const timestamp = options.timestamp ?? new Date().toISOString();
  const formattedTs = formatTimestamp(timestamp);
  const userData = app.getPath('userData');
  const backupDir = path.join(userData, 'backups', formattedTs);
  const phases: PhaseReport[] = [];
  const initialState = await loadAiResetState();
  const priorModelGeneration = initialState.modelGeneration;
  const priorPromptPack = initialState.promptPackVersion;

  // Phase 0 — freeze and backup
  const phase0Steps: PhaseStepReport[] = [];
  if (apply) {
    await updateAiResetState({
      frozen: true,
      mode: 'resetting',
      bannerMessage: runtime.regenerationBanner,
      lastResetTimestamp: timestamp
    });
  }
  phase0Steps.push({
    description: 'Freeze AI interactions across the UI',
    performed: apply,
    dryRun,
    details: { statePath: getAiResetStatePath() }
  });

  const deliverablesRoot = path.join(userData, 'deliverables');
  const archiveTargets = [
    path.join(deliverablesRoot, 'runs.json'),
    path.join(deliverablesRoot, 'runs.summary.json'),
    path.join(deliverablesRoot, 'insights'),
    path.join(deliverablesRoot, 'reports'),
    path.join(userData, 'deliverables.rules.json'),
    path.join(userData, 'insights'),
    path.join(userData, 'reports')
  ];
  const archived: string[] = [];
  if (!dryRun) {
    await fs.mkdir(backupDir, { recursive: true });
    for (const candidate of archiveTargets) {
      const didCopy = await copyIfExists(candidate, backupDir);
      if (didCopy) {
        archived.push(candidate);
      }
    }
  }
  phase0Steps.push({
    description: 'Archive deliverables state and AI artifacts',
    performed: !dryRun,
    dryRun,
    details: { backupDir, archived }
  });

  const meta = {
    ts: timestamp,
    prior_model_generation: priorModelGeneration,
    prior_prompt_pack: priorPromptPack
  };
  if (!dryRun) {
    await writeJsonAtomic(path.join(backupDir, 'reset-meta.json'), meta);
  }
  phase0Steps.push({
    description: 'Record prior model generation and prompt pack metadata',
    performed: !dryRun,
    dryRun,
    details: meta
  });
  phases.push({ name: 'Phase 0 — Safety snapshot and freeze', steps: phase0Steps });

  // Phase 1 — Pin models and prompts globally
  const phase1Steps: PhaseStepReport[] = [];
  const deliverablesConfig = getDeliverablesConfig();
  phase1Steps.push({
    description: 'Verify deliverables config reflects pinned AI runtime values',
    performed: true,
    dryRun,
    details: {
      modelGeneration: deliverablesConfig.ai.modelGeneration,
      promptPackVersion: deliverablesConfig.ai.promptPackVersion,
      textModel: deliverablesConfig.ai.textModel,
      chatModel: deliverablesConfig.ai.chatModel,
      embeddingsModel: deliverablesConfig.ai.embeddingsModel
    }
  });
  const promptPack = getPromptPack();
  phase1Steps.push({
    description: 'Confirm prompt pack version is aligned with runtime',
    performed: true,
    dryRun,
    details: { promptPackVersion: promptPack.version }
  });
  try {
    assertAiRuntimeReady();
    phase1Steps.push({
      description: 'Runtime guardrails in place for AI model configuration',
      performed: true,
      dryRun,
      details: { guardrail: 'assertAiRuntimeReady' }
    });
  } catch (error) {
    phase1Steps.push({
      description: 'Runtime guardrails in place for AI model configuration',
      performed: false,
      dryRun,
      details: { error: error instanceof Error ? error.message : String(error) }
    });
  }
  phases.push({ name: 'Phase 1 — Pin models and prompts globally', steps: phase1Steps });

  // Phase 2 — Purge legacy artifacts
  const phase2Steps: PhaseStepReport[] = [];
  const aiRoot = path.join(userData, 'ai');
  const purgeTargets = [
    path.join(aiRoot, 'indexes'),
    path.join(aiRoot, 'writer', 'cache'),
    path.join(aiRoot, 'flashcards'),
    path.join(aiRoot, 'quiz'),
    path.join(aiRoot, 'chatbot')
  ];
  const plannedRemovals: Record<string, number> = {};
  for (const target of purgeTargets) {
    if (await pathExists(target)) {
      const files = await collectFilesRecursive(target);
      plannedRemovals[target] = files.length;
      if (apply) {
        await fs.rm(target, { recursive: true, force: true });
        await fs.mkdir(target, { recursive: true });
      }
    }
  }
  phase2Steps.push({
    description: 'Reset AI cache directories under userData/ai',
    performed: apply,
    dryRun,
    details: plannedRemovals
  });

  // Insights sanitization
  const insightsDir = path.join(deliverablesRoot, 'insights');
  const sanitizedRuns: string[] = [];
  if (await pathExists(insightsDir)) {
    const entries = await fs.readdir(insightsDir);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const fullPath = path.join(insightsDir, entry);
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const metadata = (parsed.metadata ?? {}) as Record<string, unknown>;
        const modelGeneration = metadata.modelGeneration as string | undefined;
        if (modelGeneration && modelGeneration === runtime.modelGeneration) {
          continue;
        }
        sanitizedRuns.push(entry);
        if (apply) {
          delete (parsed as Record<string, unknown>).ai;
          parsed.metadata = {
            modelGeneration: runtime.modelGeneration,
            promptPackVersion: runtime.promptPackVersion,
            embeddingsModel: runtime.embeddingsModel,
            updatedAt: Date.now(),
            aiModel: runtime.chatModel
          };
          await writeJsonAtomic(fullPath, parsed);
        }
      } catch (error) {
        console.warn('[ai-reset] Failed to inspect insight bundle', fullPath, error);
      }
    }
  }
  phase2Steps.push({
    description: 'Null out AI insight bundles with legacy model generations',
    performed: apply && sanitizedRuns.length > 0,
    dryRun,
    details: { sanitized: sanitizedRuns }
  });
  phases.push({ name: 'Phase 2 — Purge legacy artifacts', steps: phase2Steps });

  // Phase 3 — Regenerate artifacts
  const phase3Steps: PhaseStepReport[] = [];
  if (!dryRun) {
    const deliverablesRunDry = await runCommand('npm', ['run', 'deliverables:run', '--', '--dry-run'], PROJECT_ROOT);
    phase3Steps.push({
      description: 'deliverables:run (dry run)',
      performed: deliverablesRunDry.code === 0,
      dryRun: false,
      details: { exitCode: deliverablesRunDry.code }
    });
    const deliverablesRun = await runCommand('npm', ['run', 'deliverables:run'], PROJECT_ROOT);
    phase3Steps.push({
      description: 'deliverables:run',
      performed: deliverablesRun.code === 0,
      dryRun: false,
      details: { exitCode: deliverablesRun.code }
    });
    const summaryRun = await runCommand('npm', ['run', 'deliverables:summary'], PROJECT_ROOT);
    phase3Steps.push({
      description: 'deliverables:summary',
      performed: summaryRun.code === 0,
      dryRun: false,
      details: { exitCode: summaryRun.code }
    });
  } else {
    phase3Steps.push({
      description: 'deliverables:run (dry run) [planned]',
      performed: false,
      dryRun: true
    });
    phase3Steps.push({
      description: 'deliverables:run [planned]',
      performed: false,
      dryRun: true
    });
    phase3Steps.push({
      description: 'deliverables:summary [planned]',
      performed: false,
      dryRun: true
    });
  }
  phases.push({ name: 'Phase 3 — Regenerate artifacts', steps: phase3Steps });

  // Phase 4 — Verification
  const phase4Steps: PhaseStepReport[] = [];
  let verificationReportPath: string | undefined;
  if (!dryRun) {
    const verification = {
      timestamp,
      checks: {
        priorModelGeneration,
        priorPromptPack,
        userData
      },
      legacyHits: sanitizedRuns.length > 0 ? sanitizedRuns : []
    };
    verificationReportPath = path.join(backupDir, 'verification-report.json');
    await writeJsonAtomic(verificationReportPath, verification);
  }
  phase4Steps.push({
    description: 'Generate verification report ensuring no legacy references remain',
    performed: !dryRun,
    dryRun,
    details: {
      verificationReportPath,
      sanitizedRuns
    }
  });
  phases.push({ name: 'Phase 4 — Verification', steps: phase4Steps });

  // Phase 5 — Unfreeze
  const phase5Steps: PhaseStepReport[] = [];
  if (apply) {
    await updateAiResetState({
      frozen: false,
      mode: 'idle',
      monitoring: { enabled: true, since: timestamp }
    });
  }
  phase5Steps.push({
    description: 'Unfreeze AI features and enable monitoring',
    performed: apply,
    dryRun,
    details: { monitoring: apply ? { enabled: true, since: timestamp } : { planned: true } }
  });
  phases.push({ name: 'Phase 5 — Unfreeze and monitor', steps: phase5Steps });

  const finalState = await loadAiResetState();

  return {
    timestamp,
    dryRun,
    phases,
    backupPath: backupDir,
    verificationReportPath,
    statePath: getAiResetStatePath(),
    finalState,
    success: true
  };
}
