import test from 'node:test';
import assert from 'node:assert/strict';
import { lintDeliverableText } from '../pipeline/lint';

test('lintDeliverableText throws for banned placeholder', () => {
  assert.throws(() => lintDeliverableText('This needs a citation [SOURCE NEEDED].'), /Banned token/);
});

test('lintDeliverableText normalises double punctuation', () => {
  const cleaned = lintDeliverableText('This is complete.. Ready.');
  assert.equal(cleaned.includes('..'), false);
});
