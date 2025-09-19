import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { sanitizeAssignment } from '../../ai/pipeline/sanitize';
import { writeDeliverable } from '../../ai/pipeline/writeDeliverable';
import { renderDocx } from '../docx/renderDocx';
import { BANNED } from '../../ai/pipeline/lint';

const fixturesDir = path.resolve(__dirname, '../../../..', 'fixtures');

function readFixture(name: string) {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

test('rendered DOCX does not contain banned tokens', async () => {
  const clean = sanitizeAssignment(readFixture('assignment_prompt.html'));
  const deliverable = await writeDeliverable(clean);
  const result = await renderDocx(deliverable);
  const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
    execFile('unzip', ['-p', result.path, 'word/document.xml'], (error, stdoutValue) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: stdoutValue.toString() });
    });
  });
  const xml = stdout.toLowerCase();
  for (const token of BANNED) {
    assert.ok(!xml.includes(token.toLowerCase()), `found banned token ${token}`);
  }
  await fsPromises.rm(path.dirname(result.path), { recursive: true, force: true });
});
