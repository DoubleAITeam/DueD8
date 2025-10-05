import { describe, expect, it, vi } from 'vitest';

const { handlers, mocks } = vi.hoisted(() => {
  const handlerMap: Record<string, (...args: unknown[]) => unknown> = {};
  const revealMock = vi.fn(async () => true);
  const openMock = vi.fn(async () => ({ ok: true }));
  const trashMock = vi.fn(async () => ({ ok: true }));
  const zipRunMock = vi.fn(async () => ({ ok: true, archivePath: '/tmp/archive.zip' }));
  const zipArtifactsMock = vi.fn(async () => ({ ok: true, archivePath: '/tmp/selected.zip' }));
  const sweepMock = vi.fn(async () => ({ removed: [], kept: [], errors: [] }));
  return {
    handlers: handlerMap,
    mocks: { revealMock, openMock, trashMock, zipRunMock, zipArtifactsMock, sweepMock }
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler;
    },
    removeHandler: vi.fn()
  }
}));

vi.mock('../../electron/deliverables/osActions', () => ({
  revealInFolder: mocks.revealMock,
  openPath: mocks.openMock,
  moveToTrash: mocks.trashMock
}));

vi.mock('../../electron/deliverables/archive', () => ({
  zipRun: mocks.zipRunMock,
  zipArtifacts: mocks.zipArtifactsMock
}));

vi.mock('../../electron/deliverables/retention', () => ({
  sweepOldOutputs: mocks.sweepMock
}));

import '../../electron/deliverables/ipc';

describe('deliverables ipc os/archive/retention', () => {
  it('routes OS actions', async () => {
    const revealHandler = handlers['deliverables:revealInFolder'];
    const openHandler = handlers['deliverables:openPath'];
    const trashHandler = handlers['deliverables:moveToTrash'];
    expect(revealHandler).toBeDefined();
    expect(openHandler).toBeDefined();
    expect(trashHandler).toBeDefined();
    await revealHandler?.(null, '/tmp/file.pdf');
    await openHandler?.(null, '/tmp/file.pdf');
    await trashHandler?.(null, '/tmp/file.pdf');
    expect(mocks.revealMock).toHaveBeenCalledWith('/tmp/file.pdf');
    expect(mocks.openMock).toHaveBeenCalledWith('/tmp/file.pdf');
    expect(mocks.trashMock).toHaveBeenCalledWith('/tmp/file.pdf');
  });

  it('invokes archive helpers', async () => {
    const zipRunHandler = handlers['deliverables:zipRun'];
    const zipArtifactsHandler = handlers['deliverables:zipArtifacts'];
    expect(zipRunHandler).toBeDefined();
    expect(zipArtifactsHandler).toBeDefined();
    await zipRunHandler?.(null, 'run-123');
    await zipArtifactsHandler?.(null, 'run-123', ['a', 'b']);
    expect(mocks.zipRunMock).toHaveBeenCalledWith('run-123');
    expect(mocks.zipArtifactsMock).toHaveBeenCalledWith(['a', 'b'], 'run-123');
  });

  it('normalises retention configs', async () => {
    const handler = handlers['deliverables:sweepOldOutputs'];
    expect(handler).toBeDefined();
    await handler?.(null, { keepDays: '45', maxArchives: '10', dryRun: '1' });
    expect(mocks.sweepMock).toHaveBeenCalledWith({ keepDays: 45, maxArchives: 10, dryRun: true });
  });
});
