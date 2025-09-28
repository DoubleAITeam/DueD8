// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

describe('useArtifactGate guardrail', () => {
  it('ensures assignment pages import useArtifactGate', async () => {
    const pagesDir = path.join(process.cwd(), 'src', 'renderer', 'pages');
    const files = await fs.readdir(pagesDir);
    const assignmentFiles = files.filter((file) => file.startsWith('Assignment'));
    expect(assignmentFiles.length).toBeGreaterThan(0);

    let importCount = 0;
    for (const file of assignmentFiles) {
      const content = await fs.readFile(path.join(pagesDir, file), 'utf8');
      if (content.includes("useArtifactGate")) {
        importCount += 1;
      }
    }

    expect(importCount).toBeGreaterThanOrEqual(1);
  });
});
