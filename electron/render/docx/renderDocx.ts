import { Document, HeadingLevel, Packer, Paragraph, TextRun } from './docxLoader';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { lintDeliverableText } from '../../ai/pipeline/lint';
import type { Deliverable } from '../../ai/pipeline/writeDeliverable';

const SECTION_SPLITTER = '\u241E';

export async function renderDocx(deliverable: Deliverable, outPath: string) {
  const doc = new Document({
    styles: {
      default: {
        heading1: { run: { size: 28, bold: true }, paragraph: { spacing: { after: 120 } } },
        document: { run: { size: 24, font: 'Times New Roman' } }
      }
    }
  });

  const children: Paragraph[] = [];
  if (deliverable.title) {
    children.push(new Paragraph({ text: deliverable.title, heading: HeadingLevel.HEADING_1 }));
  }

  const joinedBodies = deliverable.sections
    .map((section) => section.body ?? '')
    .join(SECTION_SPLITTER);
  const lintedBodies = lintDeliverableText(joinedBodies);
  const bodySegments = lintedBodies.split(SECTION_SPLITTER);

  deliverable.sections.forEach((section, index) => {
    const heading = section.heading ?? '';
    if (heading) {
      children.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_2 }));
    }
    const body = bodySegments[index] ?? '';
    children.push(new Paragraph({ children: [new TextRun(body)] }));
  });

  if (deliverable.references?.length) {
    const lintedReferences = lintDeliverableText(deliverable.references.join(SECTION_SPLITTER))
      .split(SECTION_SPLITTER);
    children.push(new Paragraph({ text: 'References', heading: HeadingLevel.HEADING_2 }));
    lintedReferences.forEach((reference) => {
      children.push(new Paragraph({ text: reference }));
    });
  }

  doc.addSection({ children });
  const buffer = await Packer.toBuffer(doc);

  const targetDir = path.dirname(outPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(outPath, buffer);
  return buffer;
}

export async function renderDocxToTemp(deliverable: Deliverable) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dued8-docx-'));
  const file = path.join(dir, 'deliverable.docx');
  const buffer = await renderDocx(deliverable, file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  await fs.promises.rm(dir, { recursive: true, force: true });
  return arrayBuffer;
}
