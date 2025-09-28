import { DeliverablesDataStore, createJobId } from './dataStore';
import { LocalObjectStorageAdapter } from './storageAdapter';
import { CanvasIngestJob } from './jobs/canvasIngestJob';
import { AiGenerateJob, AiModelClient, DemoAiModelClient } from './jobs/aiGenerateJob';
import { RenderArtifactsJob } from './jobs/renderArtifactsJob';
import { ArtifactValidator } from './jobs/validateArtifact';
import { ArtifactRecord } from './types';
import { downloadCanvasFile, CanvasFileDownload } from '../canvasService';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { mainLog } from '../logger';
import { logDeliverablesTrace } from '../telemetry';

export type DeliverablesPipelineInput = {
  assignmentId: string;
  canvasFileId: string;
  prompt: string;
};

type Downloader = (fileId: string) => ReturnType<typeof import('./jobs/canvasIngestJob').then>; // can't do this.

type CanvasDownloader = (fileId: string) => Promise<CanvasFileDownload>;

export class DeliverablesPipeline {
  private store: DeliverablesDataStore;
  private storage: LocalObjectStorageAdapter;
  private aiClient: AiModelClient;
  private downloader?: CanvasDownloader;

  constructor(options?: {
    store?: DeliverablesDataStore;
    storage?: LocalObjectStorageAdapter;
    aiClient?: AiModelClient;
    downloader?: CanvasDownloader;
  }) {
    this.store = options?.store ?? new DeliverablesDataStore();
    this.storage = options?.storage ?? new LocalObjectStorageAdapter();
    this.aiClient = options?.aiClient ?? new DemoAiModelClient();
    this.downloader = options?.downloader;
  }

  async run(
    input: DeliverablesPipelineInput,
    options?: { jobId?: string; trace?: Record<string, unknown> }
  ): Promise<{ jobId: string; artifacts: ArtifactRecord[] }> {
    const jobId = options?.jobId ?? createJobId('deliverables');
    const timers: Record<string, number> = {};
    const start = () => Date.now();
    logDeliverablesTrace(jobId, input.assignmentId, 'start', options?.trace);

    try {
      timers.ingest = start();
      const ingestJob = new CanvasIngestJob(
        this.store,
        this.storage,
        this.downloader ?? ((fileId) => downloadCanvasFile(fileId))
      );
      const ingestResult = await ingestJob.execute({
        assignmentId: input.assignmentId,
        canvasFileId: input.canvasFileId
      });
      mainLog('[deliverables]', { jobId, stage: 'ingest', latency_ms: Date.now() - timers.ingest });

      timers.generate = start();
      const aiJob = new AiGenerateJob(this.store, this.aiClient);
      const aiResult = await aiJob.execute({
        assignmentId: input.assignmentId,
        prompt: input.prompt,
        materials: [
          {
            filename: ingestResult.filename,
            sha256: ingestResult.sha256
          }
        ]
      });
      mainLog('[deliverables]', { jobId, stage: 'generate', latency_ms: Date.now() - timers.generate });

      timers.render = start();
      const renderJob = new RenderArtifactsJob(this.store, this.storage);
      const { docx, pdf } = await renderJob.execute({
        assignmentId: input.assignmentId,
        artifactGroupId: aiResult.artifactGroupId,
        payload: aiResult.payload
      });
      mainLog('[deliverables]', {
        jobId,
        stage: 'render-result',
        docxParagraphs: docx.paragraphCount,
        pdfTextLength: pdf.paragraphCount
      });
      mainLog('[deliverables]', { jobId, stage: 'render', latency_ms: Date.now() - timers.render });

      timers.validate = start();
      const validator = new ArtifactValidator(this.store, this.storage);
      const validatedDocx = await validator.execute(docx);
      const validatedPdf = await validator.execute(pdf);
      mainLog('[deliverables]', { jobId, stage: 'validate', latency_ms: Date.now() - timers.validate });
      mainLog('[deliverables]', {
        jobId,
        stage: 'done',
        artifacts: [validatedDocx.artifactId, validatedPdf.artifactId]
      });
      logDeliverablesTrace(jobId, input.assignmentId, 'completed', {
        artifactIds: [validatedDocx.artifactId, validatedPdf.artifactId]
      });

      return {
        jobId,
        artifacts: [validatedDocx, validatedPdf]
      };
    } catch (error) {
      const err = error as Error & { code?: string };
      mainLog('[deliverables]', {
        jobId,
        stage: 'failed',
        code: err.code ?? 'UNKNOWN',
        message: err.message
      });
      logDeliverablesTrace(jobId, input.assignmentId, 'failed', {
        code: err.code ?? 'UNKNOWN',
        message: err.message
      });
      throw error;
    }
  }

  async listArtifacts(assignmentId: string) {
    return this.store.listArtifactsForAssignment(assignmentId);
  }

  async resolveSignedUrl(url: string) {
    return this.storage.resolveSignedUrl(url);
  }
}

export function createDemoCanvasDownloader(options?: { filePath?: string; filename?: string; mime?: string }) {
  const filePath = options?.filePath ?? path.join(process.cwd(), 'tests/fixtures/canvas-material.pdf');
  const filename = options?.filename ?? 'canvas-material.pdf';
  const mime = options?.mime ?? 'application/pdf';

  return async (): Promise<CanvasFileDownload> => {
    const body = await fs.readFile(filePath);
    return {
      ok: true,
      status: 200,
      filename,
      contentType: mime,
      body
    };
  };
}
