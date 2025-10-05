import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';

const { tempDir, moveToTrashMock } = vi.hoisted(() => {
  const fsModule = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsModule.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-retention-'));
  const moveMock = vi.fn(async () => ({ ok: true }));
  return { tempDir: dir, moveToTrashMock: moveMock };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  }
}));

vi.mock('../../electron/deliverables/osActions', () => ({
  moveToTrash: moveToTrashMock
}));

import { saveRun } from '../../electron/deliverables/dataStore';
import { sweepOldOutputs } from '../../electron/deliverables/retention';

const outputsRoot = path.join(tempDir, 'deliverables', 'outputs');
const runOld = path.join(outputsRoot, 'run-old');
const runNew = path.join(outputsRoot, 'run-new');

const now = Date.now();

describe('deliverables retention sweep', () => {
  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(runOld, { recursive: true });
    await fs.mkdir(runNew, { recursive: true });
    await fs.writeFile(path.join(runOld, 'artifact-a.pdf'), 'old');
    await fs.writeFile(path.join(runNew, 'artifact-a.pdf'), 'new');

    await saveRun({
      runId: 'run-old',
      startedAt: now - 45 * 24 * 60 * 60 * 1000,
      finishedAt: now - 45 * 24 * 60 * 60 * 1000,
      results: [
        { id: 'artifact-a', success: true }
      ]
    });

    await saveRun({
      runId: 'run-new',
      startedAt: now - 2 * 24 * 60 * 60 * 1000,
      finishedAt: now - 2 * 24 * 60 * 60 * 1000,
      results: [
        { id: 'artifact-a', success: true }
      ]
    });

    moveToTrashMock.mockClear();
    process.env.DELIV_PROTECT_RECENT_RUNS = '0';
    delete process.env.DELIV_HARD_DELETE;
    resetDeliverablesConfigCache();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.DELIV_PROTECT_RECENT_RUNS;
    delete process.env.DELIV_HARD_DELETE;
    resetDeliverablesConfigCache();
  });

  it('identifies stale outputs without deleting during dry run', async () => {
    const plan = await sweepOldOutputs({ keepDays: 30, dryRun: true });
    expect(plan.removed).toContain(path.join(outputsRoot, 'run-old'));
    expect(plan.kept).toContain(path.join(outputsRoot, 'run-new'));
    expect(moveToTrashMock).not.toHaveBeenCalled();
  });

  it('applies retention using the trash by default', async () => {
    const result = await sweepOldOutputs({ keepDays: 30, dryRun: false });
    expect(result.removed).toContain(path.join(outputsRoot, 'run-old'));
    expect(moveToTrashMock).toHaveBeenCalledWith(path.join(outputsRoot, 'run-old'));
  });

  it('performs hard deletes when configured', async () => {
    process.env.DELIV_HARD_DELETE = '1';
    resetDeliverablesConfigCache();
    const result = await sweepOldOutputs({ keepDays: 30, dryRun: false });
    expect(result.removed).toContain(path.join(outputsRoot, 'run-old'));
    expect(moveToTrashMock).not.toHaveBeenCalled();
    await expect(fs.access(runOld)).rejects.toThrow();
  });

  it('respects protectRecentRuns even when past keepDays', async () => {
    process.env.DELIV_PROTECT_RECENT_RUNS = '2';
    resetDeliverablesConfigCache();
    const plan = await sweepOldOutputs({ keepDays: 30, dryRun: true });
    expect(plan.removed).not.toContain(path.join(outputsRoot, 'run-old'));
  });
});
