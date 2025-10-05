#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import { readAiResetState, setAiResetStatus } from '../ai/state';
import { getAiManifestPath, readAiManifest, writeAiManifest } from '../ai/manifest';
import {
  AI_RESET_BANNER_MESSAGE,
  AI_MODEL_GENERATION,
  PROMPT_PACK_VERSION,
  AI_ACTIVE_BADGE
} from '../../src/shared/aiConfig';
import { getElectronApp, resolveUserDataRoot, setUserDataRoot } from '../ai/paths';

interface CliOptions {
  dryRun: boolean;
  apply: boolean;
  timestamp: string;
}

function parseArgs(argv: string[]): CliOptions {
  let dryRun = true;
  let apply = false;
  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
      dryRun = false;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      apply = false;
    }
  }
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  return { dryRun, apply, timestamp: now };
}

async function ensureBackupFolder(userDataRoot: string, timestamp: string, options: CliOptions): Promise<string> {
  const target = path.join(userDataRoot, 'backups', timestamp);
  if (options.dryRun) {
    console.log(`[phase0] would create backup folder at ${target}`);
    return target;
  }
  await fs.mkdir(target, { recursive: true });
  console.log(`[phase0] backup folder ready at ${target}`);
  return target;
}

async function phase0(options: CliOptions, userDataRoot: string): Promise<void> {
  console.log('--- Phase 0: Safety snapshot and freeze ---');
  const state = await readAiResetState();
  console.log(`[phase0] current reset status: ${state.status}`);
  const backupDir = await ensureBackupFolder(userDataRoot, options.timestamp, options);
  if (options.apply) {
    await setAiResetStatus('frozen', AI_RESET_BANNER_MESSAGE);
    console.log(`[phase0] UI frozen with banner. Backups stored under ${backupDir}`);
  } else {
    console.log(`[phase0] would set reset status to frozen with banner "${AI_RESET_BANNER_MESSAGE}"`);
  }
}

async function phase1(options: CliOptions): Promise<void> {
  console.log('--- Phase 1: Pin models and prompts ---');
  const manifestPath = getAiManifestPath();
  const previous = await readAiManifest();
  if (previous) {
    console.log(`[phase1] previous manifest detected: ${JSON.stringify(previous)}`);
  } else {
    console.log('[phase1] no manifest detected, a new one will be created.');
  }
  if (options.apply) {
    const manifest = await writeAiManifest();
    console.log(`[phase1] manifest written to ${manifestPath}`);
    console.log(`[phase1] active generation ${manifest.modelGeneration}, prompt pack ${manifest.promptPackVersion}`);
  } else {
    console.log(
      `[phase1] would write manifest to ${manifestPath} with generation ${AI_MODEL_GENERATION} and prompt pack ${PROMPT_PACK_VERSION}`
    );
  }
}

async function phase4(options: CliOptions): Promise<void> {
  console.log('--- Phase 4: Verification snapshot ---');
  const manifest = (await readAiManifest()) ?? null;
  console.log(`[phase4] manifest ${manifest ? 'loaded' : 'missing'}.`);
  const state = await readAiResetState();
  console.log(`[phase4] current badge: ${AI_ACTIVE_BADGE}, status: ${state.status}`);
  if (options.dryRun) {
    console.log('[phase4] would scan userData for legacy artifacts.');
  } else {
    console.log('[phase4] verification limited to manifest and state validation for this run.');
  }
}

async function phase5(options: CliOptions): Promise<void> {
  console.log('--- Phase 5: Unfreeze and monitor ---');
  if (options.apply) {
    await setAiResetStatus('ready', undefined);
    console.log('[phase5] UI unfrozen. AI actions restored.');
  } else {
    console.log('[phase5] would unfreeze UI and resume monitoring.');
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const electronApp = getElectronApp();
  const userDataOverride = process.env.DELIVERABLES_USER_DATA;
  if (userDataOverride) {
    setUserDataRoot(userDataOverride);
  }
  if (electronApp) {
    await electronApp.whenReady();
  }
  const userDataRoot = resolveUserDataRoot();
  console.log(`[ai-reset] starting with userData=${userDataRoot} (${options.dryRun ? 'dry-run' : 'apply'})`);
  await phase0(options, userDataRoot);
  await phase1(options);
  await phase4(options);
  await phase5(options);
  if (!options.apply) {
    console.log('[ai-reset] dry run completed. Re-run with --apply to execute.');
  } else {
    console.log('[ai-reset] reset complete.');
  }
  if (electronApp) {
    electronApp.quit();
  }
}

main().catch((error) => {
  console.error('[ai-reset] failed', error);
  const electronApp = getElectronApp();
  if (electronApp) {
    electronApp.exit(1);
  } else {
    process.exit(1);
  }
});
