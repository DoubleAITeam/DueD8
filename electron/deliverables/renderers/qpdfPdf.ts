import fs from 'node:fs/promises';
import path from 'node:path';
import { getRenderFlags, getTimeoutMs } from '../config';
import type { DeliverableJobResult } from '../types';
import type { AdapterHealth, RendererAdapter } from './adapter';
import { spawnWithLimits, which } from '../utils/tools';

const ADAPTER_ID = 'qpdf-pdf';
const TOOL_CANDIDATES = ['qpdf'];

let cachedToolPath: { value: string | null; timestamp: number } | null = null;
const TOOL_CACHE_TTL = 60_000;

async function resolveToolPath(): Promise<string | null> {
  const now = Date.now();
  if (cachedToolPath && now - cachedToolPath.timestamp < TOOL_CACHE_TTL) {
    return cachedToolPath.value;
  }

  for (const candidate of TOOL_CANDIDATES) {
    const located = await which(candidate);
    if (located) {
      cachedToolPath = { value: located, timestamp: now };
      return located;
    }
  }

  cachedToolPath = { value: null, timestamp: now };
  return null;
}

async function verifyTool(toolPath: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const result = await spawnWithLimits(toolPath, ['--version'], {
      timeoutMs: Math.min(10_000, getTimeoutMs())
    });
    if (result.code === 0) {
      const versionLine = result.stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
      return { ok: true, message: versionLine };
    }
    return {
      ok: false,
      message: result.stderr.trim() || 'qpdf returned non-zero exit during health check.'
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    const message = err?.message ?? 'Failed to verify qpdf.';
    return {
      ok: false,
      message
    };
  }
}

export const qpdfPdfAdapter: RendererAdapter = {
  id: ADAPTER_ID,
  handles: ['pdf'],
  async health(): Promise<AdapterHealth> {
    const flags = getRenderFlags();
    if (!flags.pdf_qpdf) {
      return { ok: false, message: 'disabled by flag' };
    }

    const toolPath = await resolveToolPath();
    if (!toolPath) {
      return { ok: false, message: 'qpdf executable not found in PATH.' };
    }

    const verification = await verifyTool(toolPath);
    if (!verification.ok) {
      return { ok: false, message: verification.message };
    }

    return { ok: true, message: verification.message };
  },
  async render({ artifact, outDir, signal, dryRun }): Promise<DeliverableJobResult> {
    const baseResult: DeliverableJobResult = {
      id: artifact.id,
      success: false,
      adapterId: ADAPTER_ID,
      dryRun: Boolean(dryRun)
    };

    if (signal.aborted) {
      return {
        ...baseResult,
        message: 'Render aborted before starting.',
        errors: [
          {
            code: 'MISSING_FILE',
            details: 'Render aborted via abort signal.'
          }
        ]
      };
    }

    if (dryRun) {
      return {
        ...baseResult,
        success: true,
        message: 'Dry run complete — no files written.'
      };
    }

    try {
      await fs.mkdir(outDir, { recursive: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to prepare output directory.';
      return {
        ...baseResult,
        message,
        errors: [
          {
            code: 'MISSING_FILE',
            details: message
          }
        ]
      };
    }

    const toolPath = await resolveToolPath();
    if (!toolPath) {
      return {
        ...baseResult,
        message: 'qpdf executable not found in PATH.',
        errors: [
          {
            code: 'MISSING_FILE',
            details: 'qpdf executable not found.'
          }
        ]
      };
    }

    const destination = path.join(outDir, `${artifact.id}.pdf`);
    const tempDestination = `${destination}.working`;

    try {
      const { code, stderr } = await spawnWithLimits(toolPath, ['--linearize', artifact.srcPath, tempDestination], {
        timeoutMs: getTimeoutMs(),
        signal
      });

      if (code !== 0) {
        await fs.rm(tempDestination, { force: true }).catch(() => undefined);
        const message = stderr.trim() || `qpdf exited with code ${code}`;
        return {
          ...baseResult,
          message,
          errors: [
            {
              code: 'MISSING_FILE',
              details: message
            }
          ]
        };
      }

      await fs.rename(tempDestination, destination);

      return {
        ...baseResult,
        success: true,
        outputPath: destination,
        message: 'PDF linearized via qpdf.'
      };
    } catch (error) {
      await fs.rm(tempDestination, { force: true }).catch(() => undefined);
      const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      const message = err?.message ?? 'qpdf invocation failed.';
      return {
        ...baseResult,
        message,
        errors: [
          {
            code: 'MISSING_FILE',
            details: message
          }
        ]
      };
    }
  }
};

export default qpdfPdfAdapter;
