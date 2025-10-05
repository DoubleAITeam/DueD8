import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ArtifactInput } from '../../electron/deliverables/types';
import { runDeliverablePipeline } from '../../electron/deliverables/pipeline';
import { setRules, resetRules } from '../../electron/deliverables/postprocess/config';
import type { Rule } from '../../electron/deliverables/postprocess/types';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'pipeline-post-'));
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

describe('deliverables pipeline post-processing', () => {
  const sourcePdf = path.join(tempDir, 'source.pdf');
  const rules: Rule[] = [
    {
      id: 'rename',
      enabled: true,
      when: { type: ['pdf'], badge: ['success'] },
      actions: [
        { kind: 'rename', pattern: '(.+)(\\.pdf)', replace: '{courseId}_{assignmentId}_{artifactId}$2' }
      ]
    },
    {
      id: 'move',
      enabled: true,
      when: { type: ['pdf'], badge: ['success'] },
      actions: [
        { kind: 'move', targetDir: '{courseId}/{assignmentId}' }
      ]
    }
  ];

  beforeAll(async () => {
    await fs.writeFile(sourcePdf, 'pdf-data');
  });

  afterEach(async () => {
    await resetRules();
    await fs.rm(path.join(tempDir, 'deliverables'), { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('records dry-run actions without moving files', async () => {
    await setRules(rules);

    const artifact: ArtifactInput = {
      id: 'artifact-dry',
      srcPath: sourcePdf,
      type: 'pdf'
    };

    const { run } = await runDeliverablePipeline([artifact], {
      dryRun: false,
      post: {
        enable: true,
        dryRun: true,
        ctx: { courseId: 'IT-214', assignmentId: 'P3' }
      }
    });

    expect(run.post?.dryRun).toBe(true);
    expect(run.post?.results).toHaveLength(1);
    const postResult = run.post?.results[0];
    expect(postResult?.appliedRuleIds).toEqual(['rename', 'move']);
    expect(postResult?.outputs.every((entry) => entry.ok)).toBe(true);

    const outputDir = path.join(tempDir, 'deliverables', 'outputs');
    const runOutput = run.results[0]?.outputPath;
    expect(runOutput?.startsWith(outputDir)).toBe(true);
    await expect(fs.access(runOutput as string)).resolves.not.toThrow();
  });

  it('renames and moves files when post-processing is enabled', async () => {
    await setRules(rules);

    const artifact: ArtifactInput = {
      id: 'artifact-real',
      srcPath: sourcePdf,
      type: 'pdf'
    };

    const { run } = await runDeliverablePipeline([artifact], {
      post: {
        enable: true,
        dryRun: false,
        ctx: { courseId: 'IT-214', assignmentId: 'P3' }
      }
    });

    expect(run.post?.success).toBe(true);
    const postResult = run.post?.results[0];
    expect(postResult?.appliedRuleIds).toEqual(['rename', 'move']);
    const finalPath = run.results[0]?.outputPath;
    const expectedPath = path.join(
      tempDir,
      'deliverables',
      'final',
      'IT-214',
      'P3',
      'IT-214_P3_artifact-real.pdf'
    );
    expect(finalPath).toBe(expectedPath);
    await expect(fs.access(expectedPath)).resolves.not.toThrow();
  });
});
