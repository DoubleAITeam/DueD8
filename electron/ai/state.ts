import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  AI_RESET_BANNER_MESSAGE,
  AI_MODEL_GENERATION,
  PROMPT_PACK_VERSION,
  type AiResetState,
  type AiResetStatus
} from '../../src/shared/aiConfig';
import { resolveUserDataRoot } from './paths';

function getAiRoot(): string {
  return path.join(resolveUserDataRoot(), 'ai');
}

function getStatePath(): string {
  return path.join(getAiRoot(), 'reset-state.json');
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonAtomic(targetPath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(targetPath);
  await ensureDir(dir);
  const tempPath = path.join(dir, `${path.basename(targetPath)}.${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  await fs.rename(tempPath, targetPath);
}

function buildDefaultState(): AiResetState {
  return {
    status: 'ready',
    bannerMessage: undefined,
    updatedAt: new Date().toISOString(),
    modelGeneration: AI_MODEL_GENERATION,
    promptPackVersion: PROMPT_PACK_VERSION
  };
}

export async function readAiResetState(): Promise<AiResetState> {
  const statePath = getStatePath();
  try {
    const raw = await fs.readFile(statePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AiResetState>;
    return {
      ...buildDefaultState(),
      ...parsed,
      updatedAt: parsed?.updatedAt ?? new Date().toISOString()
    } satisfies AiResetState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const fallback = buildDefaultState();
      await writeJsonAtomic(statePath, fallback);
      return fallback;
    }
    throw error;
  }
}

export async function writeAiResetState(next: Partial<AiResetState> & { status: AiResetStatus }): Promise<AiResetState> {
  const current = await readAiResetState();
  const merged: AiResetState = {
    ...current,
    ...next,
    bannerMessage: next.bannerMessage ?? current.bannerMessage ?? AI_RESET_BANNER_MESSAGE,
    modelGeneration: next.modelGeneration ?? current.modelGeneration ?? AI_MODEL_GENERATION,
    promptPackVersion: next.promptPackVersion ?? current.promptPackVersion ?? PROMPT_PACK_VERSION,
    updatedAt: new Date().toISOString()
  };
  await writeJsonAtomic(getStatePath(), merged);
  return merged;
}

export async function setAiResetStatus(status: AiResetStatus, bannerMessage?: string): Promise<AiResetState> {
  return writeAiResetState({ status, bannerMessage });
}
