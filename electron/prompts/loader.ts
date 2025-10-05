import fs from 'node:fs';
import path from 'node:path';
import { PROMPT_PACK_VERSION } from '../../src/shared/aiConfig';

const cache = new Map<string, string>();

function resolvePromptPath(key: string): string {
  const safeKey = key.replace(/\.{2,}/g, '_');
  return path.join(__dirname, PROMPT_PACK_VERSION, `${safeKey}.txt`);
}

export function getPromptTemplate(key: string): string {
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  const filePath = resolvePromptPath(key);
  const contents = fs.readFileSync(filePath, 'utf8');
  cache.set(key, contents);
  return contents;
}

export function renderPromptTemplate(key: string, variables: Record<string, string | number | undefined>): string {
  const template = getPromptTemplate(key);
  return template.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => {
    const replacement = variables[token];
    if (replacement === undefined || replacement === null) {
      return '';
    }
    return String(replacement);
  });
}
