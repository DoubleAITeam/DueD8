import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ArtifactInput, DeliverableJobResult } from '../types';
import type { AdapterHealth, RendererAdapter } from './adapter';

const ADAPTER_ID = 'copy-docx';

async function checkWritable(): Promise<AdapterHealth> {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${ADAPTER_ID}-health-`));
    const testFile = path.join(tempDir, 'probe.txt');
    await fs.writeFile(testFile, 'ok', 'utf-8');
    await fs.rm(tempDir, { recursive: true, force: true });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Failed to verify filesystem write access.'
    };
  }
}

function buildBaseResult(artifact: ArtifactInput): DeliverableJobResult {
  return {
    id: artifact.id,
    success: false,
    adapterId: ADAPTER_ID
  };
}

function buildAbortResult(artifact: ArtifactInput): DeliverableJobResult {
  return {
    ...buildBaseResult(artifact),
    message: 'Render aborted before completion.',
    errors: [
      {
        code: 'MISSING_FILE',
        details: 'Render aborted via abort signal.'
      }
    ]
  };
}

function isAbort(signal: AbortSignal): boolean {
  return signal.aborted;
}

export const copyDocxAdapter: RendererAdapter = {
  id: ADAPTER_ID,
  handles: ['docx'],
  async health() {
    return checkWritable();
  },
  async render({ artifact, outDir, signal, dryRun }): Promise<DeliverableJobResult> {
    if (isAbort(signal)) {
      return buildAbortResult(artifact);
    }

    const destination = path.join(outDir, `${artifact.id}.docx`);
    const metaPath = `${destination}.meta.json`;
    const baseResult = buildBaseResult(artifact);

    try {
      await fs.mkdir(outDir, { recursive: true });

      if (isAbort(signal)) {
        return buildAbortResult(artifact);
      }

      if (!dryRun) {
        await fs.copyFile(artifact.srcPath, destination);
      }

      if (isAbort(signal)) {
        if (!dryRun) {
          await fs.rm(destination, { force: true });
        }
        return buildAbortResult(artifact);
      }

      const meta = {
        adapterId: ADAPTER_ID,
        artifactId: artifact.id,
        sourcePath: artifact.srcPath,
        outputPath: dryRun ? null : destination,
        dryRun: Boolean(dryRun),
        generatedAt: new Date().toISOString()
      };

      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

      return {
        ...baseResult,
        success: true,
        dryRun: Boolean(dryRun),
        outputPath: dryRun ? metaPath : destination,
        message: dryRun
          ? 'Dry run complete — metadata written only.'
          : 'Render completed successfully.'
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown render error';
      return {
        ...baseResult,
        success: false,
        message: `Adapter ${ADAPTER_ID} failed: ${message}`,
        errors: [
          {
            code: 'MISSING_FILE',
            details: message
          }
        ],
        transientErrorCode: err?.code
      };
    }
  }
};

export default copyDocxAdapter;

