import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { matchRule } from '../../electron/deliverables/postprocess/engine';
import type { Rule } from '../../electron/deliverables/postprocess/types';
import type { DeliverableJobResult } from '../../electron/deliverables/types';

const { tempDir } = vi.hoisted(() => {
  const fsSync = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsSync.mkdtempSync(pathModule.join(osModule.tmpdir(), 'post-rules-match-'));
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

describe('postprocess matchRule', () => {
  const outputsDir = path.join(tempDir, 'deliverables', 'outputs', 'run-1');
  const baseResult: DeliverableJobResult = {
    id: 'artifact-1',
    success: true,
    outputPath: path.join(outputsDir, 'sample.pdf'),
    adapterId: 'copy-pdf',
    type: 'pdf',
    badge: 'success'
  };

  beforeAll(async () => {
    await fs.mkdir(outputsDir, { recursive: true });
    await fs.writeFile(baseResult.outputPath as string, 'sample-data');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('matches by type and badge', () => {
    const rule: Rule = {
      id: 'type-badge',
      enabled: true,
      when: {
        type: ['pdf'],
        badge: ['success']
      },
      actions: []
    };

    expect(matchRule(baseResult, {}, rule)).toBe(true);
  });

  it('requires adapter id when specified', () => {
    const rule: Rule = {
      id: 'adapter-filter',
      enabled: true,
      when: {
        adapterId: ['libreoffice']
      },
      actions: []
    };

    expect(matchRule(baseResult, {}, rule)).toBe(false);
  });

  it('performs case-insensitive path matching', () => {
    const rule: Rule = {
      id: 'path-filter',
      enabled: true,
      when: {
        pathIncludes: ['SAMPLE']
      },
      actions: []
    };

    expect(matchRule(baseResult, {}, rule)).toBe(true);
  });

  it('respects minimum and maximum size constraints', async () => {
    const sizedPath = path.join(outputsDir, 'large.pdf');
    await fs.writeFile(sizedPath, 'x'.repeat(2 * 1024 * 1024));
    const sizedResult: DeliverableJobResult = {
      ...baseResult,
      id: 'artifact-2',
      outputPath: sizedPath
    };

    const rule: Rule = {
      id: 'size-window',
      enabled: true,
      when: {
        minSizeMb: 1,
        maxSizeMb: 3
      },
      actions: []
    };

    expect(matchRule(sizedResult, {}, rule)).toBe(true);

    const tooSmallRule: Rule = {
      id: 'too-small',
      enabled: true,
      when: {
        minSizeMb: 5
      },
      actions: []
    };

    expect(matchRule(sizedResult, {}, tooSmallRule)).toBe(false);
  });

  it('skips disabled rules', () => {
    const rule: Rule = {
      id: 'disabled',
      enabled: false,
      when: {},
      actions: []
    };

    expect(matchRule(baseResult, {}, rule)).toBe(false);
  });
});
