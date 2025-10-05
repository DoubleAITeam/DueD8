import { ArtifactKind, DeliverableJobResult } from '../types';

export type PostAction =
  | { kind: 'rename'; pattern: string; replace: string }
  | { kind: 'move'; targetDir: string }
  | { kind: 'tag'; key: string; value: string };

export interface RuleCondition {
  type?: ArtifactKind[];
  minSizeMb?: number;
  maxSizeMb?: number;
  adapterId?: string[];
  badge?: ('success' | 'warning' | 'error' | 'cancelled' | 'skipped')[];
  pathIncludes?: string[];
}

export interface Rule {
  id: string;
  description?: string;
  enabled: boolean;
  when: RuleCondition;
  actions: PostAction[];
}

export interface CourseContext {
  courseId?: string;
  courseName?: string;
  assignmentId?: string;
  dueDateIso?: string;
  meta?: Record<string, string | number | boolean>;
}

export interface PostResult {
  artifactId: string;
  appliedRuleIds: string[];
  outputs: { from: string; to?: string; action: string; ok: boolean; message?: string }[];
}
