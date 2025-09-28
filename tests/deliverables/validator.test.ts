import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import JSZip from 'jszip';
import { renderDocx } from '../../electron/deliverables/renderers/docxRenderer';
import { renderPdf } from '../../electron/deliverables/renderers/pdfRenderer';
import { DeliverablesDataStore } from '../../electron/deliverables/dataStore';
import { LocalObjectStorageAdapter } from '../../electron/deliverables/storageAdapter';
import { ArtifactValidator } from '../../electron/deliverables/jobs/validateArtifact';
import { createArtifactRecord } from '../../electron/deliverables/types';
import type { DeliverableJson } from '../../electron/deliverables/jobs/aiGenerateJob';

const sampleDeliverable: DeliverableJson = {
  title: 'Validation Demo',
  assignment_id: 'assignment-1',
  summary:
    'This is a robust summary of the Canvas material that highlights expectations, deliverables, and evaluation criteria in detail to satisfy validation thresholds.',
  sections: [
    {
      heading: 'Section One',
      body_markdown:
        'Paragraph one with details.\n\nAdditional context to ensure paragraph count and rich content that will be reflected in the rendered outputs.'
    },
    {
      heading: 'Section Two',
      body_markdown:
        'Another paragraph of meaningful text to satisfy validation rules, reinforcing that the draft contains substantive guidance for the student in long-form prose.'
    },
    ...Array.from({ length: 4 }, (_, index) => ({
      heading: `Extended Topic ${index + 3}`,
      body_markdown:
        'Extended elaboration on the topic to enrich the generated file with multiple paragraphs and actionable recommendations pulled from Canvas context.'
    }))
  ],
  citations: [{ label: 'Source 1', url: 'https://example.com' }],
  metadata: { course: 'Demo Course', due_at_iso: new Date().toISOString() }
};

async function createHarness() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deliverables-validator-'));
  const store = new DeliverablesDataStore(dir);
  const storage = new LocalObjectStorageAdapter(path.join(dir, 'objects'));
  return { store, storage };
}

async function createLowContentDocx() {
  const zip = new JSZip();
  const filler = 'X'.repeat(6000);
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="R1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip
    .folder('word')
    ?.folder('_rels')
    ?.file(
      'document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
    );
  zip
    .folder('word')
    ?.file(
      'document.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Assignment Title</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Overview</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Details</w:t></w:r></w:p>
    <w:p><w:r><w:t>Short content ${filler}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph with filler ${filler}</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`
    );
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('ArtifactValidator', () => {
  it('validates DOCX and PDF artifacts', async () => {
    const { store, storage } = await createHarness();
    const docxRendered = renderDocx(sampleDeliverable);
    const docxObject = await storage.putObject(docxRendered.buffer, 'docx');
    const docxRecord = createArtifactRecord({
      assignmentId: 'assignment-1',
      type: 'docx',
      sha256: docxObject.sha256,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: docxObject.bytes,
      storageKey: docxObject.storageKey
    });
    docxRecord.paragraphCount = docxRendered.paragraphCount;
    await store.createArtifact(docxRecord);

    const pdfRendered = await renderPdf(sampleDeliverable);
    const pdfObject = await storage.putObject(pdfRendered.buffer, 'pdf');
    const pdfRecord = createArtifactRecord({
      assignmentId: 'assignment-1',
      type: 'pdf',
      sha256: pdfObject.sha256,
      mime: 'application/pdf',
      bytes: pdfObject.bytes,
      storageKey: pdfObject.storageKey
    });
    pdfRecord.pageCount = pdfRendered.pageCount;
    pdfRecord.paragraphCount = pdfRendered.textLength;
    await store.createArtifact(pdfRecord);
    const validator = new ArtifactValidator(store, storage);
    const validatedDocx = await validator.execute(docxRecord);
    expect(validatedDocx.status).toBe('valid');
    expect(validatedDocx.paragraphCount).toBeGreaterThanOrEqual(6);

    const validatedPdf = await validator.execute(pdfRecord);
    expect(validatedPdf.status).toBe('valid');
    expect(validatedPdf.pageCount).toBeGreaterThanOrEqual(1);
});

  it('fails DOCX artifacts that do not meet content thresholds', async () => {
    const { store, storage } = await createHarness();
    const docxBuffer = await createLowContentDocx();
    const docxObject = await storage.putObject(docxBuffer, 'docx');
    const docxRecord = createArtifactRecord({
      assignmentId: 'assignment-lean',
      type: 'docx',
      sha256: docxObject.sha256,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      bytes: docxObject.bytes,
      storageKey: docxObject.storageKey
    });
    docxRecord.paragraphCount = 2;
    await store.createArtifact(docxRecord);

    const validator = new ArtifactValidator(store, storage);
    const validated = await validator.execute(docxRecord);

    expect(validated.status).toBe('failed');
    expect(validated.errorCode).toBe('LOW_CONTENT');
    expect(validated.signedUrl).toBeNull();
  });
});
