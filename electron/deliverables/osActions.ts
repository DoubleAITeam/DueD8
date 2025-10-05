import { app, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

import { getDeliverablesConfig } from './config';

type NormalisedPathResult = { ok: true; path: string } | { ok: false; message: string };

function getUserDataRoot(): string {
  return path.resolve(app.getPath('userData'));
}

function normaliseCandidate(input: string): string {
  if (!input) {
    return input;
  }
  const candidate = path.isAbsolute(input)
    ? input
    : path.join(getUserDataRoot(), input);
  return path.resolve(candidate);
}

function isWithinUserData(candidate: string): boolean {
  const userData = getUserDataRoot();
  const normalisedUserData = process.platform === 'win32' ? userData.toLowerCase() : userData;
  const normalisedCandidate = process.platform === 'win32'
    ? candidate.toLowerCase()
    : candidate;

  if (normalisedCandidate === normalisedUserData) {
    return true;
  }

  const prefix = normalisedUserData.endsWith(path.sep)
    ? normalisedUserData
    : `${normalisedUserData}${path.sep}`;
  return normalisedCandidate.startsWith(prefix);
}

async function ensureExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function resolveTarget(rawPath: string): NormalisedPathResult {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return { ok: false, message: 'Path is required.' };
  }

  const resolved = normaliseCandidate(rawPath.trim());
  if (!getDeliverablesConfig().os.allowExternalMove && !isWithinUserData(resolved)) {
    return { ok: false, message: 'Operation restricted to application storage.' };
  }

  return { ok: true, path: resolved };
}

export async function revealInFolder(p: string): Promise<boolean> {
  try {
    const resolved = resolveTarget(p);
    if (!resolved.ok) {
      return false;
    }

    if (!(await ensureExists(resolved.path))) {
      return false;
    }

    shell.showItemInFolder(resolved.path);
    return true;
  } catch (error) {
    console.error('[deliverables:osActions] revealInFolder failed', error);
    return false;
  }
}

export async function openPath(p: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const resolved = resolveTarget(p);
    if (!resolved.ok) {
      return { ok: false, message: resolved.message };
    }

    if (!(await ensureExists(resolved.path))) {
      return { ok: false, message: 'Path does not exist.' };
    }

    const result = await shell.openPath(resolved.path);
    if (typeof result === 'string' && result.length > 0) {
      return { ok: false, message: result };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to open path.';
    console.error('[deliverables:osActions] openPath failed', error);
    return { ok: false, message };
  }
}

export async function moveToTrash(p: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const resolved = resolveTarget(p);
    if (!resolved.ok) {
      return { ok: false, message: resolved.message };
    }

    if (!(await ensureExists(resolved.path))) {
      return { ok: false, message: 'Path does not exist.' };
    }

    await shell.trashItem(resolved.path);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to move item to trash.';
    console.error('[deliverables:osActions] moveToTrash failed', error);
    return { ok: false, message };
  }
}
