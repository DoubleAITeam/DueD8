import { randomUUID } from 'node:crypto';

export type ArtifactType = 'docx' | 'pdf';
export type ArtifactStatus = 'pending' | 'valid' | 'failed';

export type ArtifactRecord = {
  artifactId: string;
  assignmentId: string;
  type: ArtifactType;
  status: ArtifactStatus;
  sha256: string;
  mime: string;
  bytes: number;
  pageCount: number | null;
  paragraphCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  validatedAt: string | null;
  signedUrl: string | null;
  storageKey: string;
};

export const createArtifactRecord = (input: {
  assignmentId: string;
  type: ArtifactType;
  sha256: string;
  mime: string;
  bytes: number;
  storageKey: string;
}): ArtifactRecord => ({
  artifactId: randomUUID(),
  assignmentId: input.assignmentId,
  type: input.type,
  status: 'pending',
  sha256: input.sha256,
  mime: input.mime,
  bytes: input.bytes,
  pageCount: null,
  paragraphCount: null,
  errorCode: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  validatedAt: null,
  signedUrl: null,
  storageKey: input.storageKey
});

export type MaterialStatus = 'pending' | 'ready' | 'failed';

export type MaterialRecord = {
  materialId: string;
  assignmentId: string;
  canvasFileId: string;
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  storageKey: string;
  status: MaterialStatus;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export const createMaterialRecord = (input: {
  assignmentId: string;
  canvasFileId: string;
  filename: string;
  mime: string;
  bytes: number;
  sha256: string;
  storageKey: string;
}): MaterialRecord => ({
  materialId: randomUUID(),
  assignmentId: input.assignmentId,
  canvasFileId: input.canvasFileId,
  filename: input.filename,
  mime: input.mime,
  bytes: input.bytes,
  sha256: input.sha256,
  storageKey: input.storageKey,
  status: 'pending',
  errorCode: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

export type JobStage = 'ingest' | 'generate' | 'render' | 'validate' | 'done' | 'failed';

export type JobLogRecord = {
  jobId: string;
  stage: JobStage;
  message: string;
  startedAt: string;
  finishedAt: string | null;
};

export const createJobLogRecord = (stage: JobStage, message: string, jobId: string): JobLogRecord => ({
  jobId,
  stage,
  message,
  startedAt: new Date().toISOString(),
  finishedAt: null
});

export type DeliverableJsonRecord = {
  jsonId: string;
  assignmentId: string;
  artifactGroupId: string;
  payload: unknown;
  sha256: string;
  createdAt: string;
};

export const createDeliverableJsonRecord = (input: {
  assignmentId: string;
  artifactGroupId: string;
  payload: unknown;
  sha256: string;
}): DeliverableJsonRecord => ({
  jsonId: randomUUID(),
  assignmentId: input.assignmentId,
  artifactGroupId: input.artifactGroupId,
  payload: input.payload,
  sha256: input.sha256,
  createdAt: new Date().toISOString()
});
