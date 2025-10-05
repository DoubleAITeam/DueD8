import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDeliverablesConfigCache } from '../../electron/deliverables/config';

const { tempDir, shellMocks } = vi.hoisted(() => {
  const fsModule = require('node:fs');
  const osModule = require('node:os');
  const pathModule = require('node:path');
  const dir = fsModule.mkdtempSync(pathModule.join(osModule.tmpdir(), 'deliverables-osactions-'));
  return {
    tempDir: dir,
    shellMocks: {
      showItemInFolder: vi.fn(() => true),
      openPath: vi.fn(async () => ''),
      trashItem: vi.fn(async () => true)
    }
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir
  },
  shell: shellMocks
}));

import { moveToTrash, openPath, revealInFolder } from '../../electron/deliverables/osActions';

describe('deliverables osActions safety', () => {
  const insideFile = path.join(tempDir, 'inside.txt');
  const outsideFile = path.join(path.dirname(tempDir), 'outside.txt');

  beforeEach(async () => {
    shellMocks.showItemInFolder.mockClear();
    shellMocks.openPath.mockClear();
    shellMocks.trashItem.mockClear();
    await fs.writeFile(insideFile, 'inside');
    await fs.writeFile(outsideFile, 'outside');
    delete process.env.DELIV_ALLOW_EXTERNAL_MOVE;
    resetDeliverablesConfigCache();
  });

  afterEach(async () => {
    await fs.rm(insideFile, { force: true });
    await fs.rm(outsideFile, { force: true });
    delete process.env.DELIV_ALLOW_EXTERNAL_MOVE;
    resetDeliverablesConfigCache();
  });

  it('blocks access outside userData by default', async () => {
    const reveal = await revealInFolder(outsideFile);
    expect(reveal).toBe(false);
    expect(shellMocks.showItemInFolder).not.toHaveBeenCalled();

    const open = await openPath(outsideFile);
    expect(open.ok).toBe(false);
    expect(open.message).toMatch(/restricted/i);
    expect(shellMocks.openPath).not.toHaveBeenCalled();

    const trash = await moveToTrash(outsideFile);
    expect(trash.ok).toBe(false);
    expect(shellMocks.trashItem).not.toHaveBeenCalled();
  });

  it('allows outside operations when explicit flag is set', async () => {
    process.env.DELIV_ALLOW_EXTERNAL_MOVE = '1';
    resetDeliverablesConfigCache();

    const reveal = await revealInFolder(outsideFile);
    expect(reveal).toBe(true);
    expect(shellMocks.showItemInFolder).toHaveBeenCalledWith(path.resolve(outsideFile));

    const open = await openPath(outsideFile);
    expect(open.ok).toBe(true);
    expect(shellMocks.openPath).toHaveBeenCalledWith(path.resolve(outsideFile));

    const trash = await moveToTrash(outsideFile);
    expect(trash.ok).toBe(true);
    expect(shellMocks.trashItem).toHaveBeenCalledWith(path.resolve(outsideFile));
  });

  it('always allows operations inside userData', async () => {
    const open = await openPath(insideFile);
    expect(open.ok).toBe(true);
    expect(shellMocks.openPath).toHaveBeenCalledWith(path.resolve(insideFile));
  });
});
