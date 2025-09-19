import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import { sanitizeAssignment } from '../pipeline/sanitize';

const fixturesDir = path.resolve(__dirname, '../../../..', 'fixtures');

function loadFixture(name: string) {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

test('sanitize removes reminder sections and banned headings', () => {
  const html = loadFixture('canvas_instructions.html');
  const clean = sanitizeAssignment(html);
  const combined = [...clean.prompts, ...(clean.rubric ?? [])].join(' ').toLowerCase();
  assert.ok(clean.prompts.every((line) => !line.toLowerCase().includes('important reminders')));
  assert.ok(!combined.includes('important reminders'));
  assert.ok(!combined.includes('plagiarism'));
});

