import fs from 'node:fs/promises';
import path from 'node:path';
import { getRenderFlags, getTimeoutMs } from '../config';
import type { DeliverableJobResult } from '../types';
import type { AdapterHealth, RendererAdapter } from './adapter';
import { spawnWithLimits, which } from '../utils/tools';

const ADAPTER_ID = 'libreoffice-docx';
const TOOL_CANDIDATES = ['soffice', 'libreoffice'];
const TOOL_CACHE_TTL = 60_000;

let cachedTool: { value: string | null; timestamp: number } | null = null;

async function resolveToolPath(): Promise<string | null> {
  const now = Date.now();
  if (cachedTool && now - cachedTool.timestamp < TOOL_CACHE_TTL) {
    return cachedTool.value;
  }

  for (const candidate of TOOL_CANDIDATES) {
    const located = await which(candidate);
    if (located) {
      cachedTool = { value: located, timestamp: now };
      return located;
    }
  }

  cachedTool = { value: null, timestamp: now };
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
      message: result.stderr.trim() || 'LibreOffice returned non-zero exit during health check.'
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    const message = err?.message ?? 'Failed to verify LibreOffice.';
    return {
      ok: false,
      message
    };
  }
}

async function findProducedPdf(outDir: string, sourcePath: string): Promise<string | null> {
  const expected = path.join(outDir, `${path.parse(sourcePath).name}.pdf`);
  try {
    await fs.access(expected);
    return expected;
  } catch {
    // Fallback: scan directory for the most recent PDF
    try {
      const entries = await fs.readdir(outDir, { withFileTypes: true });
      const pdfs = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
        .map((entry) => ({
          name: entry.name,
          fullPath: path.join(outDir, entry.name)
        }));
      if (pdfs.length === 0) {
        return null;
      }
      pdfs.sort((a, b) => a.name.localeCompare(b.name));
      return pdfs[0].fullPath;
    } catch {
      return null;
    }
  }
}

export const libreofficeDocxAdapter: RendererAdapter = {
  id: ADAPTER_ID,
  handles: ['docx'],
  async health(): Promise<AdapterHealth> {
    const flags = getRenderFlags();
    if (!flags.docx_libreoffice) {
      return { ok: false, message: 'disabled by flag' };
    }

    const toolPath = await resolveToolPath();
    if (!toolPath) {
      return { ok: false, message: 'LibreOffice executable not found.' };
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

    const toolPath = await resolveToolPath();
    if (!toolPath) {
      return {
        ...baseResult,
        message: 'LibreOffice executable not found.',
        errors: [
          {
            code: 'MISSING_FILE',
            details: 'LibreOffice executable not found.'
          }
        ]
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

    const tempDir = await fs.mkdtemp(path.join(outDir, `${artifact.id}-libreoffice-`));

    try {
      const { code, stderr } = await spawnWithLimits(
        toolPath,
        ['--headless', '--convert-to', 'pdf', '--outdir', tempDir, artifact.srcPath],
        {
          timeoutMs: getTimeoutMs(),
          signal
        }
      );

      if (code !== 0) {
        const message = stderr.trim() || `LibreOffice exited with code ${code}`;
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

      const produced = await findProducedPdf(tempDir, artifact.srcPath);
      if (!produced) {
        return {
          ...baseResult,
          message: 'LibreOffice did not produce a PDF output.',
          errors: [
            {
              code: 'MISSING_FILE',
              details: 'LibreOffice conversion output missing.'
            }
          ]
        };
      }

      const destination = path.join(outDir, `${artifact.id}.pdf`);
      const workingPath = `${destination}.working`;

      await fs.copyFile(produced, workingPath);
      if (signal.aborted) {
        await fs.rm(workingPath, { force: true }).catch(() => undefined);
        return {
          ...baseResult,
          message: 'Render aborted before completion.',
          errors: [
            {
              code: 'MISSING_FILE',
              details: 'Render aborted via abort signal.'
            }
          ]
        };
      }

      await fs.rename(workingPath, destination);

      return {
        ...baseResult,
        success: true,
        outputPath: destination,
        message: 'DOCX converted to PDF via LibreOffice.'
      };
    } catch (error) {
      await fs.rm(path.join(outDir, `${artifact.id}.pdf.working`), { force: true }).catch(() => undefined);
      if (signal.aborted) {
        return {
          ...baseResult,
          message: 'Render aborted before completion.',
          errors: [
            {
              code: 'MISSING_FILE',
              details: 'Render aborted via abort signal.'
            }
          ]
        };
      }
      const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
      const message = err?.message ?? 'LibreOffice conversion failed.';
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
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
};

export default libreofficeDocxAdapter;
