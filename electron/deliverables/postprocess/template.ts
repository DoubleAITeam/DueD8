import path from 'node:path';
import type { DeliverableJobResult } from '../types';
import type { CourseContext } from './types';

const ILLEGAL_PATH_CHARS = /[\\/\0]|[:*?"<>|]/g;
const WHITESPACE_RE = /\s+/g;

function sanitizeToken(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  const replaced = stringValue.replace(ILLEGAL_PATH_CHARS, '_');
  const collapsed = replaced.replace(WHITESPACE_RE, '_');
  return collapsed.trim();
}

export interface TemplateContext {
  result: Partial<DeliverableJobResult> & { id: string };
  course?: CourseContext;
  runId?: string;
  timestamp?: string;
}

const TOKEN_MAP: Array<{ key: string; resolve: (ctx: TemplateContext) => string }> = [
  { key: 'courseId', resolve: (ctx) => ctx.course?.courseId ?? '' },
  { key: 'courseName', resolve: (ctx) => ctx.course?.courseName ?? '' },
  { key: 'assignmentId', resolve: (ctx) => ctx.course?.assignmentId ?? '' },
  { key: 'dueDate', resolve: (ctx) => ctx.course?.dueDateIso ?? '' },
  { key: 'artifactId', resolve: (ctx) => ctx.result.id ?? '' },
  { key: 'adapterId', resolve: (ctx) => ctx.result.adapterId ?? '' },
  { key: 'type', resolve: (ctx) => ctx.result.type ?? '' },
  { key: 'runId', resolve: (ctx) => ctx.runId ?? '' },
  { key: 'timestamp', resolve: (ctx) => ctx.timestamp ?? '' }
];

export function applyTemplate(template: string, context: TemplateContext): string {
  if (!template) {
    return template;
  }

  return template.replace(/\{([^{}]+)\}/g, (_match, rawKey: string) => {
    const key = String(rawKey).trim();
    const token = TOKEN_MAP.find((entry) => entry.key === key);
    if (!token) {
      const metaValue = context.course?.meta?.[key];
      if (metaValue === undefined) {
        return '';
      }
      return sanitizeToken(metaValue);
    }
    const resolved = token.resolve(context);
    return sanitizeToken(resolved);
  });
}

export function normalizeTemplatedPath(input: string): string {
  const templated = applyTemplate(input, { result: { id: '' } });
  if (!templated) {
    return '';
  }
  const normalized = path.normalize(templated);
  if (normalized === '.' || normalized === '..') {
    return '';
  }
  return normalized;
}
