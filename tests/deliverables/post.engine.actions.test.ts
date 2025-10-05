import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import { applyActions } from '../../electron/deliverables/postprocess/engine';
import type { CourseContext, PostAction } from '../../electron/deliverables/postprocess/types';
import type { DeliverableJobResult } from '../../electron/deliverables/types';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'post-engine-'));
  return { tempDir: dir };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  },
  ipcMain: {
    handle: vi.fn(),
    removeHandler: vi.fn()
  }
}));

describe('postprocess applyActions', () => {
  const runDir = path.join(tempDir, 'deliverables', 'outputs', 'run-apply');
  const finalDir = path.join(tempDir, 'deliverables', 'final');
  const basePath = path.join(runDir, 'report.pdf');
  const baseResult: DeliverableJobResult = {
    id: 'artifact-apply',
    success: true,
    outputPath: basePath,
    adapterId: 'copy-pdf',
    type: 'pdf',
    badge: 'success'
  };
  const context: CourseContext = {
    courseId: 'IT-214',
    assignmentId: 'P3'
  };

  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(basePath, 'pdf-data');
    resetDeliverablesConfigCache();
  });

  afterEach(async () => {
    await fs.rm(path.join(tempDir, 'deliverables.rules.json'), { force: true });
    resetDeliverablesConfigCache();
  });

  it('renames files using safe regex patterns', async () => {
    const actions: PostAction[] = [
      {
        kind: 'rename',
        pattern: '(.+)(\\.pdf)',
        replace: '{courseId}_{assignmentId}$2'
      }
    ];

    const result = await applyActions(baseResult, context, actions, {
      runId: 'run-1',
      timestamp: '2024-01-01T00:00:00Z'
    });

    expect(result.outputs[0]).toMatchObject({ ok: true, action: 'rename' });
    const renamedPath = path.join(runDir, 'IT-214_P3.pdf');
    await expect(fs.access(renamedPath)).resolves.not.toThrow();
  });

  it('moves files into the final directory structure', async () => {
    const actions: PostAction[] = [
      {
        kind: 'move',
        targetDir: '{courseId}/{assignmentId}'
      }
    ];

    const result = await applyActions(baseResult, context, actions, {});

    const destination = path.join(finalDir, 'IT-214', 'P3', 'report.pdf');
    expect(result.outputs[0]).toMatchObject({ ok: true, to: destination });
    await expect(fs.access(destination)).resolves.not.toThrow();
  });

  it('records tags without touching the filesystem', async () => {
    const before = await fs.readFile(basePath, 'utf-8');
    const actions: PostAction[] = [
      {
        kind: 'tag',
        key: 'adapter',
        value: '{adapterId}'
      }
    ];

    const result = await applyActions(baseResult, context, actions, {});
    expect(result.outputs[0]).toMatchObject({ ok: true, action: 'tag' });
    const after = await fs.readFile(basePath, 'utf-8');
    expect(after).toBe(before);
  });

  it('honours dry-run mode for rename and move', async () => {
    const actions: PostAction[] = [
      { kind: 'rename', pattern: '(.+)(\\.pdf)', replace: '{courseId}$2' },
      { kind: 'move', targetDir: '{courseId}/{assignmentId}' }
    ];

    const result = await applyActions(baseResult, context, actions, { dryRun: true });
    expect(result.outputs.every((entry) => entry.ok)).toBe(true);
    await expect(fs.access(basePath)).resolves.not.toThrow();
  });

  it('rejects unsafe rename patterns', async () => {
    const actions: PostAction[] = [
      { kind: 'rename', pattern: '(.*)', replace: 'noop' }
    ];

    const result = await applyActions(baseResult, context, actions, {});
    expect(result.outputs[0]).toMatchObject({ ok: false, action: 'rename' });
    await expect(fs.access(basePath)).resolves.not.toThrow();
  });

  it('prevents external moves without explicit flag', async () => {
    const externalDir = path.join(os.tmpdir(), 'post-engine-external');
    const actions: PostAction[] = [
      { kind: 'move', targetDir: externalDir }
    ];

    const result = await applyActions(baseResult, context, actions, {});
    expect(result.outputs[0]).toMatchObject({ ok: false, action: 'move' });
    await expect(fs.access(basePath)).resolves.not.toThrow();

    process.env.DELIV_ALLOW_EXTERNAL_MOVE = '1';
    resetDeliverablesConfigCache();
    const success = await applyActions(baseResult, context, actions, {});
    expect(success.outputs[0]).toMatchObject({ ok: true, action: 'move' });
    const destination = path.join(externalDir, 'report.pdf');
    await expect(fs.access(destination)).resolves.not.toThrow();
    delete process.env.DELIV_ALLOW_EXTERNAL_MOVE;
    await fs.rm(externalDir, { recursive: true, force: true });
  });
});
