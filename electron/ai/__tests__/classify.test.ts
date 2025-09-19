import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import { sanitizeAssignment } from '../pipeline/sanitize';
import { classify } from '../pipeline/classify';

const fixturesDir = path.resolve(__dirname, '../../../..', 'fixtures');

function load(name: string) {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

test('classifier returns "instructions" for reminder-only files', async () => {
  const clean = sanitizeAssignment(load('canvas_instructions.html'));
  const type = await classify(clean);
  assert.equal(type, 'instructions');
});

test('classifier returns "deliverable_needed" for assignment prompts', async () => {
  const clean = sanitizeAssignment(load('assignment_prompt.html'));
  const type = await classify(clean);
  assert.equal(type, 'deliverable_needed');
});
