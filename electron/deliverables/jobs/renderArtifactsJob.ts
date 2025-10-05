import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtifactInput, DeliverableJobResult, ValidationError } from '../types';
import type { ArtifactKind } from '../types';

const EXTENSION_BY_TYPE: Record<ArtifactKind, string> = {
  pdf: '.pdf',
  docx: '.docx',
  html: '.html'
};

async function ensureRunDirectory(runId: string): Promise<string> {
  const runDir = path.join(app.getPath('userData'), 'deliverables', 'outputs', runId);
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
}

async function copySource(artifact: ArtifactInput, destination: string): Promise<void> {
  await fs.copyFile(artifact.srcPath, destination);
}

async function writeErrorMarker(destination: string, errorSummary: string): Promise<void> {
  await fs.writeFile(destination, `${errorSummary}\n`, 'utf-8');
}

function buildError(code: ValidationError['code'], details: string): ValidationError {
  return { code, details };
}

export async function run(artifact: ArtifactInput, runId: string): Promise<DeliverableJobResult> {
  const baseResult: DeliverableJobResult & { type: ArtifactKind } = {
    id: artifact.id,
    success: false,
    type: artifact.type
  };

  try {
    const runDir = await ensureRunDirectory(runId);
    const extension = EXTENSION_BY_TYPE[artifact.type];
    const destinationPath = path.join(runDir, `${artifact.id}${extension}`);

    await copySource(artifact, destinationPath);

    return {
      ...baseResult,
      success: true,
      message: 'Render completed successfully.',
      outputPath: destinationPath
    };
  } catch (error) {
    const runDir = await ensureRunDirectory(runId);
    const markerPath = path.join(runDir, `${artifact.id}.txt`);
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown render error';

    const errors: ValidationError[] = [buildError('MISSING_FILE', errorMessage)];

    await writeErrorMarker(markerPath, `Render failed: ${errorMessage}`);

    return {
      ...baseResult,
      success: false,
      message: `Render failed: ${errorMessage}`,
      outputPath: markerPath,
      errors
    };
  }
}
