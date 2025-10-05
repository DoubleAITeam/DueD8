import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseArtifact } from '../../electron/deliverables/insights/parsers';

describe('insights docx parser', () => {
  const tmpDir = path.join(os.tmpdir(), `insights-docx-${Date.now()}`);
  const docxPath = path.join(tmpDir, 'sample.docx');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const zip = new JSZip();
    const docXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>Research Summary</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>This DOCX references BIO-202-205 and assignment A3.</w:t></w:r></w:p>
  </w:body>
</w:document>`;
    const coreXml = `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:creator>Grace Hopper</dc:creator>
</cp:coreProperties>`;
    const appXml = `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Pages>3</Pages>
</Properties>`;
    const typesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`;

    zip.file('[Content_Types].xml', typesXml);
    zip.folder('word')?.file('document.xml', docXml);
    zip.folder('docProps')?.file('core.xml', coreXml);
    zip.folder('docProps')?.file('app.xml', appXml);

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    await fs.writeFile(docxPath, buffer);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads docx core properties and text content', async () => {
    const result = await parseArtifact(docxPath, 'docx');
    expect(result.title).toBe('Research Summary');
    expect(result.author).toBe('Grace Hopper');
    expect(result.pageCount).toBe(3);
    expect(result.detectedCourseId).toBe('BIO-202-205');
    expect(result.detectedAssignmentId).toBe('A3');
    expect(result.warnings).toEqual([]);
  });
});
