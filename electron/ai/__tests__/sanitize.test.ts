import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sanitizeAssignment, stripHtml } from '../pipeline/sanitize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixture(name: string) {
  return path.join(__dirname, '../../../fixtures', name);
}

test('stripHtml removes markup and scripts', async () => {
  const html = '<div><script>alert(1)</script><style>p{}</style><p>Hello</p></div>';
  assert.equal(stripHtml(html), 'Hello');
});

test('sanitizeAssignment removes reminder headings', async () => {
  const raw = await readFile(fixture('canvas_instructions.html'), 'utf8');
  const clean = sanitizeAssignment(raw);
  assert.equal(clean.prompts.length, 0);
  assert.equal(clean.rubric?.length ?? 0, 0);
});

test('sanitizeAssignment extracts prompts and rubric', async () => {
  const raw = await readFile(fixture('assignment_prompt.html'), 'utf8');
  const clean = sanitizeAssignment(raw);
  assert.ok(clean.prompts.some((line) => /750-word reflection/i.test(line)));
  assert.ok(clean.rubric?.some((line) => /Meets the expectation/i.test(line)));
});
