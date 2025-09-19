import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocxToTemp } from '../docx/renderDocx';
import type { Deliverable } from '../../ai/pipeline/writeDeliverable';
import { getBannedTokens } from '../../ai/pipeline/lint';

test('renderDocx produces document without banned tokens', async () => {
  const deliverable: Deliverable = {
    title: 'Sample Submission',
    sections: [
      { heading: 'Introduction', body: 'This response analyses course concepts with evidence.' },
      { heading: 'Conclusion', body: 'All directives are satisfied.' }
    ]
  };

  const arrayBuffer = await renderDocxToTemp(deliverable);
  const buffer = Buffer.from(new Uint8Array(arrayBuffer));
  const xmlString = buffer.toString('utf8');
  getBannedTokens().forEach((token) => {
    assert.equal(xmlString.toLowerCase().includes(token.toLowerCase()), false);
  });
  assert.equal(xmlString.includes('..'), false);
});
