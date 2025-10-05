import type { CourseContext, PostResult } from './postprocess/types';

export type ArtifactKind = 'pdf' | 'docx' | 'html';

export interface ArtifactInput {
  id: string;
  srcPath: string;
  type: ArtifactKind;
}

export interface ValidationError {
  code: 'MISSING_FILE' | 'UNSUPPORTED_TYPE' | 'EMPTY_FILE' | 'SIZE_LIMIT';
  details?: string;
}

export type DeliverableLogLevel = 'info' | 'warn' | 'error';

export interface DeliverableLogEntry {
  timestamp: number;
  level: DeliverableLogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
}

export type BadgeKind = 'success' | 'warning' | 'error' | 'cancelled' | 'skipped';

export interface RunSummary {
  runId: string;
  startedAt: number;
  finishedAt: number;
  totals: {
    count: number;
    ok: number;
    failed: number;
    cancelled: number;
    skipped: number;
  };
  byType: Record<ArtifactKind, { count: number; ok: number; failed: number }>;
  adaptersUsed: Record<string, number>;
  fallbackCount: number;
  durationMs: number;
  headline: string;
  bullets: string[];
}

export interface DeliverableJobResult {
  id: string;
  success: boolean;
  message?: string;
  outputPath?: string;
  errors?: ValidationError[];
  adapterId?: string;
  adapterReason?: string;
  attempted?: string[];
  attempts?: number;
  transientFailureCodes?: string[];
  transientErrorCode?: string;
  dryRun?: boolean;
  type?: ArtifactKind;
  badge?: BadgeKind;
}

export interface DeliverableRunRecord {
  runId: string;
  startedAt: number;
  finishedAt: number;
  results: DeliverableJobResult[];
  options?: {
    dryRun?: boolean;
    concurrency?: number;
    post?: {
      enable?: boolean;
      dryRun?: boolean;
    };
  };
  post?: {
    success: boolean;
    results: PostResult[];
    ctx?: CourseContext;
    dryRun?: boolean;
  };
}

export interface AiSummaryPayload {
  content: string;
  model: string;
  modelGeneration: string;
  promptPackVersion: string;
  createdAt: string;
}
