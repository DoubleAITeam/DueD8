import { app } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDeliverablesConfig } from '../config';
import type { DeliverableJobResult } from '../types';
import { applyTemplate, type TemplateContext } from './template';
import type { CourseContext, PostAction, PostResult, Rule } from './types';

const MB = 1024 * 1024;

function resolveOutputsRoot(): string {
  return path.resolve(path.join(app.getPath('userData'), 'deliverables', 'outputs'));
}

function resolveFinalRoot(): string {
  return path.resolve(path.join(app.getPath('userData'), 'deliverables', 'final'));
}

function isWithin(base: string, candidate: string): boolean {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function safeRegex(pattern: string): RegExp | null {
  if (!pattern) {
    return null;
  }
  const trimmed = pattern.trim();
  if (!trimmed) {
    return null;
  }
  let anchored = trimmed;
  if (!anchored.startsWith('^')) {
    anchored = `^${anchored}`;
  }
  if (!anchored.endsWith('$')) {
    anchored = `${anchored}$`;
  }
  try {
    const regex = new RegExp(anchored, 'u');
    if (regex.test('')) {
      return null;
    }
    return regex;
  } catch (error) {
    console.warn('[postprocess:engine] Invalid rename pattern rejected', error);
    return null;
  }
}

function getSizeMb(result: DeliverableJobResult): number | null {
  const outputPath = result.outputPath;
  if (!outputPath) {
    return null;
  }
  try {
    const stat = fs.statSync(outputPath);
    if (!stat.isFile()) {
      return null;
    }
    return stat.size / MB;
  } catch {
    return null;
  }
}

function matchesCondition<T>(values: T[] | undefined, candidate: T | undefined): boolean {
  if (!values || values.length === 0) {
    return true;
  }
  if (candidate === undefined || candidate === null) {
    return false;
  }
  return values.includes(candidate);
}

export function matchRule(result: DeliverableJobResult, _ctx: CourseContext, rule: Rule): boolean {
  if (!rule.enabled) {
    return false;
  }

  const conditions = rule.when ?? {};

  if (!matchesCondition(conditions.type, result.type)) {
    return false;
  }

  if (!matchesCondition(conditions.adapterId, result.adapterId)) {
    return false;
  }

  if (!matchesCondition(conditions.badge, result.badge)) {
    return false;
  }

  if (typeof conditions.minSizeMb === 'number' || typeof conditions.maxSizeMb === 'number') {
    const size = getSizeMb(result);
    if (size === null) {
      return false;
    }
    if (typeof conditions.minSizeMb === 'number' && size < conditions.minSizeMb) {
      return false;
    }
    if (typeof conditions.maxSizeMb === 'number' && size > conditions.maxSizeMb) {
      return false;
    }
  }

  if (conditions.pathIncludes && conditions.pathIncludes.length > 0) {
    const outputPath = result.outputPath?.toLowerCase() ?? '';
    const includesAll = conditions.pathIncludes.every((needle) =>
      outputPath.includes(String(needle).toLowerCase())
    );
    if (!includesAll) {
      return false;
    }
  }

  return true;
}

function resolveTemplateContext(
  result: DeliverableJobResult,
  course: CourseContext,
  opts: { runId?: string; timestamp?: string }
): TemplateContext {
  return {
    result: {
      ...result
    },
    course,
    runId: opts.runId,
    timestamp: opts.timestamp
  };
}

async function ensureFileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fsp.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

interface ApplyOptions {
  dryRun?: boolean;
  ruleIds?: string[];
  runId?: string;
  timestamp?: string;
  allowExternalMove?: boolean;
}

export async function applyActions(
  result: DeliverableJobResult,
  course: CourseContext,
  actions: PostAction[],
  opts: ApplyOptions = {}
): Promise<PostResult> {
  const outputsRoot = resolveOutputsRoot();
  const finalRoot = resolveFinalRoot();
  const userDataRoot = path.resolve(app.getPath('userData'));
  const allowExternal =
    opts.allowExternalMove ?? getDeliverablesConfig().os.allowExternalMove;
  const dryRun = Boolean(opts.dryRun);
  const timestamp = opts.timestamp ?? new Date().toISOString();

  const postResult: PostResult = {
    artifactId: result.id,
    appliedRuleIds: opts.ruleIds ?? [],
    outputs: []
  };

  if (!result.success) {
    return postResult;
  }

  let currentPath = result.outputPath ? path.resolve(result.outputPath) : null;
  if (!currentPath) {
    return postResult;
  }

  if (!isWithin(outputsRoot, currentPath)) {
    postResult.outputs.push({
      from: currentPath,
      action: 'guard',
      ok: false,
      message: 'Output path is outside of the managed outputs directory.'
    });
    return postResult;
  }

  const templateContext = resolveTemplateContext(result, course, {
    runId: opts.runId,
    timestamp
  });

  const fileExists = await ensureFileExists(currentPath);
  if (!fileExists && !dryRun) {
    postResult.outputs.push({
      from: currentPath,
      action: 'guard',
      ok: false,
      message: 'Output file no longer exists. Skipping post-processing.'
    });
    return postResult;
  }

  for (const action of actions) {
    try {
      if (action.kind === 'rename') {
        const regex = safeRegex(action.pattern);
        if (!regex) {
          postResult.outputs.push({
            from: currentPath,
            action: 'rename',
            ok: false,
            message: 'Rename pattern is invalid or unsafe.'
          });
          continue;
        }

        const baseName = path.basename(currentPath);
        if (!regex.test(baseName)) {
          postResult.outputs.push({
            from: currentPath,
            action: 'rename',
            ok: false,
            message: 'Rename pattern did not match output file.'
          });
          continue;
        }

        const replacement = applyTemplate(action.replace, templateContext);
        const nextName = baseName.replace(regex, replacement);
        if (!nextName || nextName === baseName) {
          postResult.outputs.push({
            from: currentPath,
            to: path.join(path.dirname(currentPath), nextName || baseName),
            action: 'rename',
            ok: nextName === baseName,
            message: nextName === baseName
              ? 'Rename produced the same file name; no changes applied.'
              : 'Rename produced an empty name.'
          });
          continue;
        }

        const nextPath = path.join(path.dirname(currentPath), nextName);
        if (!isWithin(outputsRoot, nextPath) && !isWithin(finalRoot, nextPath)) {
          postResult.outputs.push({
            from: currentPath,
            to: nextPath,
            action: 'rename',
            ok: false,
            message: 'Rename destination is outside managed directories.'
          });
          continue;
        }

        if (!dryRun) {
          const tmpPath = `${nextPath}.tmp-${randomUUID()}`;
          try {
            await fsp.rename(currentPath, tmpPath);
            await fsp.rename(tmpPath, nextPath);
          } catch (error) {
            await fsp.rename(tmpPath, currentPath).catch(() => {
              /* best effort rollback */
            });
            throw error;
          }
        }

        postResult.outputs.push({
          from: currentPath,
          to: nextPath,
          action: 'rename',
          ok: true,
          message: dryRun ? 'Dry run — rename skipped.' : undefined
        });
        currentPath = nextPath;
        continue;
      }

      if (action.kind === 'move') {
        const templatedDir = applyTemplate(action.targetDir, templateContext);
        const normalizedDir = path.normalize(templatedDir);
        let targetDir: string;
        if (path.isAbsolute(normalizedDir)) {
          targetDir = path.resolve(normalizedDir);
        } else {
          targetDir = path.resolve(path.join(finalRoot, normalizedDir));
        }

        if (!isWithin(userDataRoot, targetDir) && !allowExternal) {
          postResult.outputs.push({
            from: currentPath,
            to: targetDir,
            action: 'move',
            ok: false,
            message: 'Move target is outside userData and external moves are disabled.'
          });
          continue;
        }

        if (!dryRun) {
          await fsp.mkdir(targetDir, { recursive: true });
        }

        const destination = path.join(targetDir, path.basename(currentPath));
        if (!dryRun) {
          const tmpPath = path.join(targetDir, `${path.basename(currentPath)}.tmp-${randomUUID()}`);
          try {
            await fsp.rename(currentPath, tmpPath);
            await fsp.rename(tmpPath, destination);
          } catch (error) {
            await fsp.rename(tmpPath, currentPath).catch(() => {
              /* best effort rollback */
            });
            throw error;
          }
        }

        postResult.outputs.push({
          from: currentPath,
          to: destination,
          action: 'move',
          ok: true,
          message: dryRun ? 'Dry run — move skipped.' : undefined
        });
        currentPath = destination;
        continue;
      }

      if (action.kind === 'tag') {
        const key = applyTemplate(action.key, templateContext) || action.key;
        const value = applyTemplate(action.value, templateContext);
        postResult.outputs.push({
          from: currentPath,
          action: 'tag',
          ok: true,
          message: `Tag ${key}=${value || ''} (metadata only).${dryRun ? ' Dry run.' : ''}`
        });
        continue;
      }

      postResult.outputs.push({
        from: currentPath,
        action: 'unknown',
        ok: false,
        message: `Unsupported post action: ${(action as { kind: string }).kind}`
      });
    } catch (error) {
      postResult.outputs.push({
        from: currentPath,
        action: action.kind,
        ok: false,
        message: error instanceof Error ? error.message : 'Unexpected post-processing failure.'
      });
    }
  }

  return postResult;
}
