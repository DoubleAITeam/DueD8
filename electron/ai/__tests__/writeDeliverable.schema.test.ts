import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import { sanitizeAssignment } from '../pipeline/sanitize';
import { writeDeliverable } from '../pipeline/writeDeliverable';
import { lintDeliverableText } from '../pipeline/lint';

const fixturesDir = path.resolve(__dirname, '../../../..', 'fixtures');

function fixture(name: string) {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

test('writeDeliverable returns valid sections and references', async () => {
  const clean = sanitizeAssignment(fixture('assignment_prompt.html'));
  const deliverable = await writeDeliverable(clean);
  assert.ok(Array.isArray(deliverable.sections));
  assert.ok(deliverable.sections.length > 0);
  for (const section of deliverable.sections) {
    assert.equal(typeof section.heading, 'string');
    assert.equal(typeof section.body, 'string');
    assert.ok(section.body.length > 0);
  }
  if (deliverable.references) {
    assert.ok(Array.isArray(deliverable.references));
  }
});

test('lintDeliverableText throws on banned markers', () => {
  assert.throws(() => lintDeliverableText('Evidence pending [SOURCE NEEDED] citation'), /Banned token detected/);
});
