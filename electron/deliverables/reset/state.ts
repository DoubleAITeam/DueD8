import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getAiRuntimeConfig } from '../config/aiRuntime';

export interface AiResetState {
  frozen: boolean;
  bannerMessage: string;
  updatedAt: string;
  modelGeneration: string;
  promptPackVersion: string;
  badgeLabel: string;
  regenerationBanner: string;
  mode?: 'idle' | 'resetting';
  monitoring?: { enabled: boolean; since?: string };
  lastVerificationReport?: string;
  lastResetTimestamp?: string;
}

function resolveStatePath(): string {
  return path.join(app.getPath('userData'), 'ai', 'reset-state.json');
}

async function ensureStateDirectory(): Promise<void> {
  const dir = path.dirname(resolveStatePath());
  await fs.mkdir(dir, { recursive: true });
}

function buildDefaultState(): AiResetState {
  const runtime = getAiRuntimeConfig();
  return {
    frozen: false,
    bannerMessage: runtime.regenerationBanner,
    updatedAt: new Date().toISOString(),
    modelGeneration: runtime.modelGeneration,
    promptPackVersion: runtime.promptPackVersion,
    badgeLabel: runtime.badgeLabel,
    regenerationBanner: runtime.regenerationBanner,
    mode: 'idle',
    monitoring: { enabled: false }
  };
}

export async function loadAiResetState(): Promise<AiResetState> {
  try {
    const raw = await fs.readFile(resolveStatePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AiResetState>;
    const defaults = buildDefaultState();
    const merged: AiResetState = {
      ...defaults,
      ...parsed,
      bannerMessage: parsed?.bannerMessage ?? defaults.bannerMessage,
      badgeLabel: defaults.badgeLabel,
      regenerationBanner: defaults.regenerationBanner,
      modelGeneration: defaults.modelGeneration,
      promptPackVersion: defaults.promptPackVersion,
      updatedAt: parsed?.updatedAt ?? defaults.updatedAt,
      monitoring: parsed?.monitoring ?? defaults.monitoring,
      mode: parsed?.mode ?? 'idle'
    };
    return merged;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return buildDefaultState();
    }
    console.error('[ai-reset:state] Failed to load state', error);
    return buildDefaultState();
  }
}

export async function saveAiResetState(state: AiResetState): Promise<void> {
  await ensureStateDirectory();
  const targetPath = resolveStatePath();
  const tmpPath = `${targetPath}.${randomUUID()}.tmp`;
  const payload = JSON.stringify(state, null, 2);
  await fs.writeFile(tmpPath, payload, 'utf8');
  await fs.rename(tmpPath, targetPath);
}

export async function updateAiResetState(patch: Partial<AiResetState>): Promise<AiResetState> {
  const current = await loadAiResetState();
  const runtime = getAiRuntimeConfig();
  const next: AiResetState = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    modelGeneration: runtime.modelGeneration,
    promptPackVersion: runtime.promptPackVersion,
    badgeLabel: runtime.badgeLabel,
    regenerationBanner: runtime.regenerationBanner
  };
  await saveAiResetState(next);
  return next;
}

export function getAiResetStatePath(): string {
  return resolveStatePath();
}
