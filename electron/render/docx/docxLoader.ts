import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let Document: typeof import('docx').Document;
let HeadingLevel: typeof import('docx').HeadingLevel;
let Packer: typeof import('docx').Packer;
let Paragraph: typeof import('docx').Paragraph;
let TextRun: typeof import('docx').TextRun;

try {
  const mod = require('docx');
  ({ Document, HeadingLevel, Packer, Paragraph, TextRun } = mod);
} catch {
  const mod = require('../../../vendor/docx');
  ({ Document, HeadingLevel, Packer, Paragraph, TextRun } = mod);
}

export { Document, HeadingLevel, Packer, Paragraph, TextRun };
