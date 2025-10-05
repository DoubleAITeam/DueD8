import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ArtifactInput, DeliverableJobResult } from '../types';
import type { AdapterHealth, RendererAdapter } from './adapter';

const ADAPTER_ID = 'static-html';

export function sanitizeHtml(input: string): string {
  const withoutScripts = input.replace(/<script[\s\S]*?<\/script>/gi, '');
  const withoutHandlers = withoutScripts.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return withoutHandlers;
}

async function checkWritable(): Promise<AdapterHealth> {
  try {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${ADAPTER_ID}-health-`));
    const testFile = path.join(tempDir, 'probe.html');
    await fs.writeFile(testFile, '<!-- ok -->', 'utf-8');
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

function ensureDocument(sanitized: string, artifactId: string): string {
  const trimmed = sanitized.trim();
  if (/<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }

  return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<title>${artifactId}</title>\n</head>\n<body>\n${trimmed}\n</body>\n</html>\n`;
}

export const staticHtmlAdapter: RendererAdapter = {
  id: ADAPTER_ID,
  handles: ['html'],
  async health() {
    return checkWritable();
  },
  async render({ artifact, outDir, signal, dryRun }): Promise<DeliverableJobResult> {
    if (signal.aborted) {
      return buildAbortResult(artifact);
    }

    const destination = path.join(outDir, `${artifact.id}.html`);
    const metaPath = `${destination}.meta.json`;
    const baseResult = buildBaseResult(artifact);

    try {
      await fs.mkdir(outDir, { recursive: true });

      if (signal.aborted) {
        return buildAbortResult(artifact);
      }

      const raw = await fs.readFile(artifact.srcPath, 'utf-8');

      if (signal.aborted) {
        return buildAbortResult(artifact);
      }

      const sanitized = ensureDocument(sanitizeHtml(raw), artifact.id);

      if (!dryRun) {
        await fs.writeFile(destination, sanitized, 'utf-8');
      }

      if (signal.aborted) {
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
          : 'HTML snapshot created successfully.'
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

export default staticHtmlAdapter;

