import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import type { DeliverableRunRecord } from '../../electron/deliverables/types';
import { buildBaseInsights, loadInsightBundle } from '../../electron/deliverables/insights/build';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'insights-build-base-'));
  return { tempDir: dir };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  }
}));

describe('insights base builder', () => {
  const artifactPath = path.join(tempDir, 'sample.html');

  beforeEach(async () => {
    process.env.DELIV_INSIGHTS_REDACT = '1';
    resetDeliverablesConfigCache();
    await fs.writeFile(
      artifactPath,
      '<html><head><title>Insight Title</title></head><body><p>SCI-201-101 report P2 words here.</p></body></html>'
    );
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('builds and persists base insight bundles', async () => {
    const run: DeliverableRunRecord = {
      runId: 'run-1',
      startedAt: Date.now(),
      finishedAt: Date.now(),
      results: [
        {
          id: 'artifact-1',
          success: true,
          outputPath: artifactPath,
          type: 'html'
        }
      ]
    };

    const bundle = await buildBaseInsights(run);
    expect(bundle.base['artifact-1']).toBeDefined();
    expect(bundle.base['artifact-1']?.detectedCourseId).toBe('SCI-201-101');
    expect(bundle.base['artifact-1']?.detectedAssignmentId).toBe('P2');
    expect(bundle.base['artifact-1']?.wordCount).toBeGreaterThan(0);
    expect(bundle.base['artifact-1']?.redacted).toBe(false);

    const persisted = await loadInsightBundle('run-1');
    expect(persisted).not.toBeNull();
    expect(persisted?.base['artifact-1']?.title).toBe('Insight Title');

    const bundlePath = path.join(tempDir, 'deliverables', 'insights', 'run-1.json');
    await expect(fs.stat(bundlePath)).resolves.toBeDefined();
  });
});
