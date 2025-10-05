import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { tempDir } = vi.hoisted(() => {
  const fsModule = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  return {
    tempDir: fsModule.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-archive-'))
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  }
}));

import { zipArtifacts, zipRun } from '../../electron/deliverables/archive';

const runId = 'run-archive';
const outputsRoot = path.join(tempDir, 'deliverables', 'outputs');
const archivesRoot = path.join(tempDir, 'deliverables', 'archives');
const directRunDir = path.join(outputsRoot, runId);
const nestedRunDir = path.join(outputsRoot, 'artifact-123', runId);

async function readArchiveEntries(archivePath: string): Promise<string[]> {
  const buffer = await fs.readFile(archivePath);
  const zip = await JSZip.loadAsync(buffer);
  return Object.keys(zip.files).filter((name) => !zip.files[name]?.dir);
}

describe('deliverables archive helpers', () => {
  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(directRunDir, { recursive: true });
    await fs.mkdir(nestedRunDir, { recursive: true });
    await fs.writeFile(path.join(directRunDir, 'artifact-a.pdf'), 'PDF');
    await fs.writeFile(path.join(directRunDir, 'artifact-b.docx'), 'DOCX');
    await fs.writeFile(path.join(nestedRunDir, 'artifact-c.html'), '<html></html>');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates a full archive for a run', async () => {
    const result = await zipRun(runId);
    expect(result.ok).toBe(true);
    expect(result.archivePath).toBe(path.join(archivesRoot, `${runId}.zip`));
    expect(result.archivePath && fsSync.existsSync(result.archivePath)).toBe(true);

    const entries = await readArchiveEntries(result.archivePath!);
    expect(entries).toEqual(
      expect.arrayContaining([
        `${runId}/artifact-a.pdf`,
        `${runId}/artifact-b.docx`,
        `artifact-123/${runId}/artifact-c.html`
      ])
    );

    const leftover = await fs.readdir(archivesRoot);
    expect(leftover.filter((name) => name.endsWith('.tmp')).length).toBe(0);
  });

  it('creates a focused archive when filtering artifacts', async () => {
    const result = await zipArtifacts(['artifact-a'], runId);
    expect(result.ok).toBe(true);
    expect(result.archivePath).toBe(path.join(archivesRoot, `${runId}-selected.zip`));
    const entries = await readArchiveEntries(result.archivePath!);
    expect(entries).toContain(`${runId}/artifact-a.pdf`);
    expect(entries).not.toContain(`${runId}/artifact-b.docx`);
  });
});
