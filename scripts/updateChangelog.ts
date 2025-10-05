import path from 'node:path';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

function runGit(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '..');
  const changelogPath = path.join(root, 'docs', 'CHANGELOG.md');
  const pkgPath = path.join(root, 'package.json');
  const pkgRaw = await fs.readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(pkgRaw) as { version?: string };
  const versionTag = pkg.version ? `v${pkg.version}` : '';

  const tagListRaw = runGit('tag --sort=-creatordate', root);
  const tags = tagListRaw.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
  const currentTag = runGit('describe --tags --exact-match HEAD', root) || tags[0] || versionTag || 'unreleased';
  const previousTag = tags.find((tag) => tag !== currentTag) ?? '';

  let diffSummary = '';
  if (previousTag) {
    diffSummary = runGit(`diff --stat ${previousTag}..HEAD`, root);
  }
  if (!diffSummary) {
    diffSummary = runGit('diff --stat HEAD', root) || runGit('log -5 --oneline', root);
  }

  const summaryLines = diffSummary
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const entryLines: string[] = [];
  entryLines.push(`## ${currentTag} – ${new Date().toISOString().slice(0, 10)}`);
  entryLines.push('');
  if (summaryLines.length === 0) {
    entryLines.push('- No code changes detected.');
  } else {
    for (const line of summaryLines) {
      entryLines.push(`- ${line}`);
    }
  }
  entryLines.push('');

  const existing = await fs.readFile(changelogPath, 'utf8');
  const marker = existing.indexOf('-->');
  let insertIndex = 0;
  if (marker !== -1) {
    const newlineAfterMarker = existing.indexOf('\n', marker);
    insertIndex = newlineAfterMarker === -1 ? existing.length : newlineAfterMarker + 1;
  } else {
    const firstLineBreak = existing.indexOf('\n');
    insertIndex = firstLineBreak === -1 ? existing.length : firstLineBreak + 1;
  }

  const prefix = existing.slice(0, insertIndex).replace(/\s*$/, '\n');
  const suffix = existing.slice(insertIndex).replace(/^\s*/, '\n');
  const updated = `${prefix}${entryLines.join('\n')}${suffix}`.replace(/\n{3,}/g, '\n\n');
  await fs.writeFile(changelogPath, updated.trimEnd() + '\n', 'utf8');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
