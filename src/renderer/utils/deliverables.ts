import path from 'node:path';
import type {
  ArtifactInput,
  ArtifactKind,
  DeliverableLogEntry,
  DeliverableRunRecord,
  RunSummary,
  AiSummaryPayload
} from '../../../electron/deliverables/types';
import type { CourseContext, Rule } from '../../../electron/deliverables/postprocess/types';
import type { AdapterOverviewEntry } from '../../../electron/deliverables/renderers/registry';
import type { ZipResult } from '../../../electron/deliverables/archive';
import type { RetentionConfig, RetentionSweepResult } from '../../../electron/deliverables/retention';
import type { InsightBundle } from '../../../electron/deliverables/insights/types';

export type DeliverablePipelineResult = {
  success: boolean;
  run: DeliverableRunRecord;
};

export type DeliverablePipelineOptions = {
  concurrency?: number;
  dryRun?: boolean;
  post?: { enable?: boolean; dryRun?: boolean; ctx?: CourseContext };
};

export function inferArtifactTypeByExt(filePath: string): ArtifactKind | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.html':
    case '.htm':
      return 'html';
    default:
      return null;
  }
}

function resolveAbsolute(filePath: string): string {
  if (!filePath) return filePath;
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  return path.resolve(filePath);
}

export function discoverArtifacts(candidatePaths: string[]): ArtifactInput[] {
  return candidatePaths
    .map((candidate) => candidate.trim())
    .filter((candidate) => candidate.length > 0)
    .map(resolveAbsolute)
    .map((resolvedPath) => {
      const type = inferArtifactTypeByExt(resolvedPath);
      if (!type) {
        return null;
      }
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${resolvedPath}-${Date.now()}`;
      return {
        id,
        srcPath: resolvedPath,
        type
      } satisfies ArtifactInput;
    })
    .filter((artifact): artifact is ArtifactInput => artifact !== null);
}

export async function invokeDeliverablesPipeline(
  artifacts: ArtifactInput[],
  options?: DeliverablePipelineOptions
): Promise<DeliverablePipelineResult> {
  console.log('[deliverables:utils] invoking pipeline via renderer bridge', artifacts);
  return window.electron.invoke('deliverables:runWithPost', artifacts, options);
}

export async function fetchPostRules(): Promise<Rule[]> {
  return window.electron.invoke('deliverables:getRules');
}

export async function savePostRules(rules: Rule[]): Promise<{ ok: boolean; message?: string }> {
  return window.electron.invoke('deliverables:setRules', rules);
}

export async function resetPostRules(): Promise<Rule[]> {
  return window.electron.invoke('deliverables:resetRules');
}

export async function fetchAdapterHealth(): Promise<
  Record<ArtifactKind, AdapterOverviewEntry>
> {
  return window.electron.invoke('deliverables:getAdapterHealth');
}

export async function fetchDeliverableLogs(): Promise<DeliverableLogEntry[]> {
  return window.electron.invoke('deliverables:getLogs');
}

export async function fetchRunSummary(runId: string): Promise<RunSummary | null> {
  return window.electron.invoke('deliverables:getSummary', runId);
}

export async function rebuildRunSummary(runId: string): Promise<RunSummary | null> {
  return window.electron.invoke('deliverables:rebuildSummary', runId);
}

export async function exportRunReport(
  runId: string,
  format: 'html' | 'json'
): Promise<string> {
  return window.electron.invoke('deliverables:exportReport', runId, format);
}

export async function fetchAiSummary(runId: string): Promise<AiSummaryPayload | null> {
  return window.electron.invoke('deliverables:getAiSummary', runId);
}

export async function revealOutput(path: string): Promise<boolean> {
  return window.dued8.deliverables.revealInFolder(path);
}

export async function openOutput(path: string): Promise<{ ok: boolean; message?: string }> {
  return window.dued8.deliverables.openPath(path);
}

export async function trashOutput(path: string): Promise<{ ok: boolean; message?: string }> {
  return window.dued8.deliverables.moveToTrash(path);
}

export async function createRunArchive(runId: string): Promise<ZipResult> {
  return window.dued8.deliverables.zipRun(runId);
}

export async function createSelectedArchive(runId: string, artifactIds: string[]): Promise<ZipResult> {
  return window.dued8.deliverables.zipArtifacts(runId, artifactIds);
}

export async function sweepOutputs(config?: RetentionConfig): Promise<RetentionSweepResult> {
  return window.dued8.deliverables.sweepOldOutputs(config);
}

export type InsightCorrectionPatch = {
  title?: string;
  detectedCourseId?: string;
  detectedAssignmentId?: string;
};

export async function fetchInsightBundle(runId: string): Promise<InsightBundle | null> {
  return window.electron.invoke('deliverables:getInsights', runId);
}

export async function buildInsightBundle(
  runId: string,
  options?: { limit?: number }
): Promise<InsightBundle | null> {
  return window.electron.invoke('deliverables:buildBaseInsights', runId, options);
}

export async function buildInsightAi(runId: string): Promise<InsightBundle | null> {
  return window.electron.invoke('deliverables:buildAiInsights', runId);
}

export async function saveInsightEdits(
  runId: string,
  artifactId: string,
  patch: InsightCorrectionPatch
): Promise<InsightBundle | null> {
  return window.electron.invoke('deliverables:saveInsightCorrection', runId, artifactId, patch);
}

export async function isAiInsightsEnabled(): Promise<boolean> {
  return window.electron.invoke('deliverables:isAiInsightsEnabled');
}

export async function fetchInsightRedactionInfo(): Promise<{ enabled: boolean; patterns: string[] }> {
  return window.electron.invoke('deliverables:getInsightRedactionInfo');
}
