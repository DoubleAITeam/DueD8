import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ArtifactInput } from '../../electron/deliverables/types';
import { runDeliverablePipeline } from '../../electron/deliverables/pipeline';
import { clearLogs, getLogs } from '../../electron/deliverables/logStore';
import {
  __resetRegistryForTests,
  register as registerAdapter
} from '../../electron/deliverables/renderers/registry';
import copyDocxAdapter from '../../electron/deliverables/renderers/copyDocx';
import copyPdfAdapter from '../../electron/deliverables/renderers/copyPdf';
import staticHtmlAdapter from '../../electron/deliverables/renderers/staticHtml';
import type { RendererAdapter } from '../../electron/deliverables/renderers/adapter';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-retry-'));
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

describe('deliverables pipeline retry handling', () => {
  let pdfFile: string;

  beforeAll(async () => {
    pdfFile = path.join(tempDir, 'retry.pdf');
    await fs.writeFile(pdfFile, 'PDF data');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('retries transient adapter failures and logs attempts', async () => {
    const stubAdapter: RendererAdapter = {
      id: 'stub-pdf-transient',
      handles: ['pdf'],
      async health() {
        return { ok: true };
      },
      async render({ artifact, outDir }) {
        const attemptFile = path.join(outDir, `${artifact.id}.pdf`);
        const call = (stubAdapter as unknown as { __calls?: number });
        call.__calls = (call.__calls ?? 0) + 1;
        if (call.__calls === 1) {
          return {
            id: artifact.id,
            success: false,
            adapterId: 'stub-pdf-transient',
            message: 'Temporary busy state',
            errors: [
              {
                code: 'MISSING_FILE',
                details: 'busy'
              }
            ],
            transientErrorCode: 'EBUSY'
          };
        }

        await fs.writeFile(attemptFile, 'resolved');
        return {
          id: artifact.id,
          success: true,
          adapterId: 'stub-pdf-transient',
          message: 'Completed',
          outputPath: attemptFile
        };
      }
    };

    __resetRegistryForTests();
    registerAdapter(copyDocxAdapter);
    registerAdapter(copyPdfAdapter);
    registerAdapter(staticHtmlAdapter);
    registerAdapter(stubAdapter);

    clearLogs();

    const artifacts: ArtifactInput[] = [
      { id: 'pdf-artifact', srcPath: pdfFile, type: 'pdf' }
    ];

    const result = await runDeliverablePipeline(artifacts);
    const job = result.run.results[0];

    expect(job?.success).toBe(true);
    expect(job?.adapterId).toBe('stub-pdf-transient');
    expect(job?.attempts).toBe(2);
    expect(job?.transientFailureCodes).toContain('EBUSY');
    expect(job?.message).toMatch(/succeeded after 2 attempts/i);

    const logs = getLogs();
    expect(logs.some((entry) => entry.level === 'warn' && entry.message.includes('Transient error'))).toBe(
      true
    );
    expect(logs.some((entry) => entry.level === 'info' && entry.data?.adapterId === 'stub-pdf-transient')).toBe(
      true
    );

    __resetRegistryForTests();
    registerAdapter(staticHtmlAdapter);
    registerAdapter(copyPdfAdapter);
    registerAdapter(copyDocxAdapter);
  });
});

