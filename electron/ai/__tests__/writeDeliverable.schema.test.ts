import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAssignment } from '../pipeline/sanitize';
import { writeDeliverable } from '../pipeline/writeDeliverable';
import { setCallLLM, resetCallLLM } from '../provider';

test('writeDeliverable returns structured JSON', async () => {
  const clean = sanitizeAssignment(
    'Write a 200-word summary of the article. Rubric: meets the expectation when evidence is cited.'
  );
  const result = await writeDeliverable(clean);
  assert.ok(Array.isArray(result.sections));
  assert.ok(result.sections.length > 0);
});

test('writeDeliverable throws when sections missing', async () => {
  setCallLLM(async () => JSON.stringify({ title: 'Invalid' }));
  const clean = sanitizeAssignment('Summarize the findings in one paragraph.');
  try {
    await assert.rejects(async () => writeDeliverable(clean), /Schema validation failed/);
  } finally {
    resetCallLLM();
  }
});
