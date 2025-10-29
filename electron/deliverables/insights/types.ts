import type { ArtifactKind } from '../types';

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
  warnings?: string[];
  redacted?: boolean;
}

export interface AiInsight {
  artifactId: string;
  summary?: string;
  actionItems?: string[];
  confidence?: number;
  model?: string;
  modelGeneration?: string;
  promptPackVersion?: string;
  updatedAt?: string;
}

export interface InsightMetadata {
  modelGeneration: string;
  promptPackVersion: string;
  embeddingsModel: string;
  updatedAt: number;
  aiModel?: string;
}

export interface InsightBundle {
  runId: string;
  createdAt: number;
  base: Record<string, BaseInsight>;
  ai?: Record<string, AiInsight>;
  version: number;
  metadata: InsightMetadata;
}
