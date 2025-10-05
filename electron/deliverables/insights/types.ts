import { ArtifactKind, DeliverableRunRecord } from '../types';

export interface BaseInsight {
  artifactId: string;
  kind: ArtifactKind;
  title?: string;
  author?: string;
  detectedCourseId?: string;
  detectedAssignmentId?: string;
  wordCount?: number;
  pageCount?: number;
  keywords?: string[];
  warnings?: string[];          // size > limit, unreadable, etc.
  redacted?: boolean;
}

export interface AiInsight {
  artifactId: string;
  summary?: string;             // ≤ 1200 chars
  actionItems?: string[];       // short bullets
  confidence?: number;          // 0..1
  model?: string;
  modelGeneration?: string;
  promptPackVersion?: string;
}

export interface InsightBundle {
  runId: string;
  createdAt: number;
  base: Record<string, BaseInsight>; // by artifactId
  ai?: Record<string, AiInsight>;    // optional
  version: number;                   // bump on schema change
}
