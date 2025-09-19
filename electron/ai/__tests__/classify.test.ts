import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sanitizeAssignment } from '../pipeline/sanitize';
import { classify } from '../pipeline/classify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixture(name: string) {
  return path.join(__dirname, '../../../fixtures', name);
}

test('classifier returns instructions for reminder fixture', async () => {
  const raw = await readFile(fixture('canvas_instructions.html'), 'utf8');
  const clean = sanitizeAssignment(raw);
  const type = await classify(clean);
  assert.equal(type, 'instructions');
});

test('classifier returns deliverable_needed for prompt fixture', async () => {
  const raw = await readFile(fixture('assignment_prompt.html'), 'utf8');
  const clean = sanitizeAssignment(raw);
  const type = await classify(clean);
  assert.equal(type, 'deliverable_needed');
});
