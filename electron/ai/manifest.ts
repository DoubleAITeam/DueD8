import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AI_CONFIG, type AiMetadata } from '../../src/shared/aiConfig';
import { resolveUserDataRoot } from './paths';

function getManifestPath(): string {
  return path.join(resolveUserDataRoot(), 'ai', 'config.json');
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonAtomic(targetPath: string, payload: unknown): Promise<void> {
  const dir = path.dirname(targetPath);
  await ensureDir(dir);
  const tmp = path.join(dir, `${path.basename(targetPath)}.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
  await fs.rename(tmp, targetPath);
}

export async function readAiManifest(): Promise<AiMetadata | null> {
  const manifestPath = getManifestPath();
  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(raw) as AiMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeAiManifest(overrides: Partial<AiMetadata> = {}): Promise<AiMetadata> {
  const payload: AiMetadata = {
    ...AI_CONFIG,
    ...overrides
  };
  await writeJsonAtomic(getManifestPath(), payload);
  return payload;
}

export function getAiManifestPath(): string {
  return getManifestPath();
}
