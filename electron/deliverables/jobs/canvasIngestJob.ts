import { randomUUID } from 'node:crypto';
import { downloadCanvasFile } from '../../canvasService';
import { DeliverablesDataStore } from '../dataStore';
import { createMaterialRecord, JobLogRecord } from '../types';
import { LocalObjectStorageAdapter, detectMimeByMagic, extensionFromMime } from '../storageAdapter';
import { mainError, mainLog } from '../../logger';

export type CanvasIngestJobInput = {
  assignmentId: string;
  canvasFileId: string;
};

export type CanvasIngestJobResult = {
  materialId: string;
  sha256: string;
  bytes: number;
  mime: string;
  filename: string;
};

type Downloader = (fileId: string) => ReturnType<typeof downloadCanvasFile>;

export class CanvasIngestJob {
  private store: DeliverablesDataStore;
  private storage: LocalObjectStorageAdapter;
  private downloader: Downloader;

  constructor(store: DeliverablesDataStore, storage: LocalObjectStorageAdapter, downloader: Downloader = downloadCanvasFile) {
    this.store = store;
    this.storage = storage;
    this.downloader = downloader;
  }

  async execute(input: CanvasIngestJobInput): Promise<CanvasIngestJobResult> {
    const jobId = `ingest-${randomUUID()}`;
    const jobLog: JobLogRecord = {
      jobId,
      stage: 'ingest',
      message: 'Starting Canvas ingest',
      startedAt: new Date().toISOString(),
      finishedAt: null
    };
    await this.store.appendJobLog(jobLog);

    const download = await this.downloader(input.canvasFileId);
    if (!download.ok || !download.body) {
      const errorMessage = download.error || 'Failed to download Canvas file';
      mainError('CanvasIngestJob download failed', errorMessage);
      await this.store.appendJobLog({
        jobId,
        stage: 'failed',
        message: `Canvas ingest failed: ${errorMessage}`,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      });
      throw Object.assign(new Error(errorMessage), {
        code: 'INGEST_BAD_RESPONSE'
      });
    }

    const bytes = download.body.length;
    if (bytes === 0) {
      const errorMessage = 'Canvas file returned zero-byte body';
      await this.store.appendJobLog({
        jobId,
        stage: 'failed',
        message: errorMessage,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      });
      throw Object.assign(new Error(errorMessage), {
        code: 'INGEST_BAD_RESPONSE'
      });
    }

    const detectedMime = detectMimeByMagic(download.body);
    if (!detectedMime) {
      const errorMessage = 'Unable to detect MIME type from Canvas download';
      await this.store.appendJobLog({
        jobId,
        stage: 'failed',
        message: errorMessage,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString()
      });
      throw Object.assign(new Error(errorMessage), {
        code: 'INGEST_BAD_RESPONSE'
      });
    }

    const extension = extensionFromMime(detectedMime);
    const stored = await this.storage.putObject(download.body, extension);
    const material = createMaterialRecord({
      assignmentId: input.assignmentId,
      canvasFileId: input.canvasFileId,
      filename: download.filename || `canvas-file-${input.canvasFileId}`,
      mime: detectedMime,
      bytes: stored.bytes,
      sha256: stored.sha256,
      storageKey: stored.storageKey
    });
    material.status = 'ready';
    await this.store.createMaterial(material);

    mainLog('CanvasIngestJob stored material', material.materialId, material.storageKey);

    await this.store.updateJobLog(jobId, 'ingest', {
      finishedAt: new Date().toISOString(),
      message: 'Canvas ingest completed'
    });

    await this.store.appendJobLog({
      jobId,
      stage: 'done',
      message: 'Ingest job finished',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString()
    });

    return {
      materialId: material.materialId,
      sha256: material.sha256,
      bytes: material.bytes,
      mime: material.mime,
      filename: material.filename
    };
  }
}
