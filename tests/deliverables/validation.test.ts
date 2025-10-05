import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';
import type { ArtifactInput } from '../../electron/deliverables/types';
import { run as validateArtifact } from '../../electron/deliverables/jobs/validateArtifact';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-validate-'));
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

describe('deliverables artifact validation', () => {
  let emptyFile: string;
  let htmlFile: string;
  let pdfFile: string;
  let oversizedFile: string;

  beforeAll(async () => {
    emptyFile = path.join(tempDir, 'empty.html');
    htmlFile = path.join(tempDir, 'sample.html');
    pdfFile = path.join(tempDir, 'sample.pdf');
    oversizedFile = path.join(tempDir, 'oversized.html');

    await fs.writeFile(emptyFile, '');
    await fs.writeFile(htmlFile, '<html><body>content</body></html>');
    await fs.writeFile(pdfFile, 'PDF-DATA');
    await fs.writeFile(oversizedFile, Buffer.alloc(1024 * 1024 * 2)); // 2 MB
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('accepts a valid html artifact', async () => {
    const artifact: ArtifactInput = {
      id: 'html-artifact',
      srcPath: htmlFile,
      type: 'html'
    };

    const result = await validateArtifact(artifact);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(result.message).toBe('Validation passed.');
  });

  it('accepts a valid pdf artifact', async () => {
    const artifact: ArtifactInput = {
      id: 'pdf-artifact',
      srcPath: pdfFile,
      type: 'pdf'
    };

    const result = await validateArtifact(artifact);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('flags empty files', async () => {
    const artifact: ArtifactInput = {
      id: 'empty-artifact',
      srcPath: emptyFile,
      type: 'html'
    };

    const result = await validateArtifact(artifact);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'EMPTY_FILE' })
      ])
    );
  });

  it('detects missing files', async () => {
    const artifact: ArtifactInput = {
      id: 'missing-artifact',
      srcPath: path.join(tempDir, 'does-not-exist.pdf'),
      type: 'pdf'
    };

    const result = await validateArtifact(artifact);
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MISSING_FILE' })
      ])
    );
  });

  it('enforces the configured size limit', async () => {
    const originalLimit = process.env.DELIVERABLE_MAX_MB;
    process.env.DELIVERABLE_MAX_MB = '1';
    resetDeliverablesConfigCache();

    try {
      const artifact: ArtifactInput = {
        id: 'oversized-artifact',
        srcPath: oversizedFile,
        type: 'html'
      };

      const result = await validateArtifact(artifact);
      expect(result.success).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'SIZE_LIMIT' })
        ])
      );
    } finally {
      if (originalLimit === undefined) {
        delete process.env.DELIVERABLE_MAX_MB;
      } else {
        process.env.DELIVERABLE_MAX_MB = originalLimit;
      }
      resetDeliverablesConfigCache();
    }
  });
});
