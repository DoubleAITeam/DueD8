import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeKeywords, countWords, parseArtifact } from '../../electron/deliverables/insights/parsers';

describe('insights html parser', () => {
  const tmpDir = path.join(os.tmpdir(), `insights-html-${Date.now()}`);
  const htmlPath = path.join(tmpDir, 'sample.html');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      htmlPath,
      `<!DOCTYPE html>
<html>
  <head>
    <title>Course Outline</title>
    <meta name="author" content="Ada Lovelace" />
  </head>
  <body>
    <h1>Assignment Overview</h1>
    <p>This document covers MATH-101-001 week one tasks.</p>
    <p>Students should complete A1 before the next session.</p>
  </body>
</html>`
    );
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('extracts structured fields and keywords from HTML', async () => {
    const result = await parseArtifact(htmlPath, 'html');
    expect(result.title).toBe('Assignment Overview');
    expect(result.author).toBe('Ada Lovelace');
    expect(result.detectedCourseId).toBe('MATH-101-001');
    expect(result.detectedAssignmentId).toBe('A1');
    expect(result.pageCount).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(result.text).toContain('week one tasks');

    const wordCount = countWords(result.text);
    expect(wordCount).toBeDefined();

    const keywords = computeKeywords(result.text);
    expect(keywords).toContain('assignment');
    expect((keywords ?? []).length).toBeGreaterThan(0);
  });
});
