import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CourseContext, Rule } from './types';

function resolveRulesPath(): string {
  return path.join(app.getPath('userData'), 'deliverables.rules.json');
}

async function readRulesFromDisk(): Promise<Rule[] | null> {
  try {
    const file = resolveRulesPath();
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as Rule[];
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error('[postprocess:config] Failed to read rules file', error);
    return null;
  }
}

function sanitizeRule(rule: Rule): Rule {
  return {
    ...rule,
    enabled: Boolean(rule.enabled),
    when: { ...(rule.when ?? {}) },
    actions: Array.isArray(rule.actions) ? [...rule.actions] : []
  };
}

export function getDefaultRules(_ctx?: CourseContext): Rule[] {
  return [
    {
      id: 'rename-with-course-context',
      description: 'Rename outputs to include course and assignment context.',
      enabled: true,
      when: { badge: ['success'] },
      actions: [
        {
          kind: 'rename',
          pattern: '(.+?)(\\\.[^\\.]+)?',
          replace: '{courseId}_{assignmentId}_{artifactId}$2'
        }
      ]
    },
    {
      id: 'move-successful-pdfs',
      description: 'Move successful PDFs into the final course directory.',
      enabled: true,
      when: { type: ['pdf'], badge: ['success'] },
      actions: [
        {
          kind: 'move',
          targetDir: '{courseId}/{assignmentId}'
        }
      ]
    },
    {
      id: 'tag-adapter-provenance',
      description: 'Tag artifacts with the adapter used to render them.',
      enabled: true,
      when: {},
      actions: [
        {
          kind: 'tag',
          key: 'adapter',
          value: '{adapterId}'
        }
      ]
    }
  ];
}

export async function getRules(): Promise<Rule[]> {
  const disk = await readRulesFromDisk();
  if (!disk) {
    return getDefaultRules();
  }
  return disk.map(sanitizeRule);
}

export async function setRules(rules: Rule[]): Promise<void> {
  if (!Array.isArray(rules)) {
    throw new Error('Rules must be an array.');
  }
  const normalized = rules.map(sanitizeRule);
  const file = resolveRulesPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(normalized, null, 2), 'utf-8');
}

export async function resetRules(): Promise<void> {
  try {
    const file = resolveRulesPath();
    await fs.rm(file, { force: true });
  } catch (error) {
    console.error('[postprocess:config] Failed to reset rules file', error);
  }
}
