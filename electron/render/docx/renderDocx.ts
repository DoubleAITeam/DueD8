import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { lintDeliverableText } from '../../ai/pipeline/lint';
import type { Deliverable } from '../../ai/pipeline/writeDeliverable';

function crc32(data: Uint8Array) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  let crc = 0 ^ -1;
  for (let n = 0; n < data.length; n += 1) {
    crc = (crc >>> 8) ^ table[(crc ^ data[n]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createStoredZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    let idx = 0;
    localView.setUint32(idx, 0x04034b50, true);
    idx += 4;
    localView.setUint16(idx, 20, true);
    idx += 2;
    localView.setUint16(idx, 0, true);
    idx += 2;
    localView.setUint16(idx, 0, true);
    idx += 2;
    localView.setUint16(idx, 0, true);
    idx += 2;
    localView.setUint16(idx, 0, true);
    idx += 2;
    localView.setUint32(idx, crc, true);
    idx += 4;
    localView.setUint32(idx, size, true);
    idx += 4;
    localView.setUint32(idx, size, true);
    idx += 4;
    localView.setUint16(idx, nameBytes.length, true);
    idx += 2;
    localView.setUint16(idx, 0, true);
    idx += 2;
    local.set(nameBytes, 30);

    locals.push(local);
    locals.push(data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    idx = 0;
    centralView.setUint32(idx, 0x02014b50, true);
    idx += 4;
    centralView.setUint16(idx, 20, true);
    idx += 2;
    centralView.setUint16(idx, 20, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint32(idx, crc, true);
    idx += 4;
    centralView.setUint32(idx, size, true);
    idx += 4;
    centralView.setUint32(idx, size, true);
    idx += 4;
    centralView.setUint16(idx, nameBytes.length, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint16(idx, 0, true);
    idx += 2;
    centralView.setUint32(idx, 0, true);
    idx += 4;
    centralView.setUint32(idx, offset, true);
    idx += 4;
    central.set(nameBytes, 46);

    centrals.push(central);
    offset += local.length + size;
  }

  const centralDir = concat(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  let ptr = 0;
  endView.setUint32(ptr, 0x06054b50, true);
  ptr += 4;
  endView.setUint16(ptr, 0, true);
  ptr += 2;
  endView.setUint16(ptr, 0, true);
  ptr += 2;
  endView.setUint16(ptr, entries.length, true);
  ptr += 2;
  endView.setUint16(ptr, entries.length, true);
  ptr += 2;
  endView.setUint32(ptr, centralDir.length, true);
  ptr += 4;
  endView.setUint32(ptr, offset, true);
  ptr += 4;
  endView.setUint16(ptr, 0, true);

  return concat([...locals, centralDir, end]);
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function paragraphXml(text: string, style?: 'Heading1' | 'Heading2' | 'Normal') {
  const lines = text.split(/\r?\n/).map((line) => escapeXml(line));
  if (!lines.length) {
    return '<w:p><w:r><w:t/></w:r></w:p>';
  }
  const styleXml =
    style && style.length
      ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`
      : '';
  const runs = lines
    .map((line, index) =>
      index === 0
        ? `<w:r><w:t xml:space="preserve">${line}</w:t></w:r>`
        : `<w:r><w:br/><w:t xml:space="preserve">${line}</w:t></w:r>`
    )
    .join('');
  return `<w:p>${styleXml}${runs}</w:p>`;
}

function stylesXml() {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
    '<w:name w:val="Normal"/><w:qFormat/>' +
    '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/>' +
    '<w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr>' +
    '</w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1">' +
    '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr>' +
    '</w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2">' +
    '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
    '<w:rPr><w:b/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr>' +
    '</w:style>' +
    '</w:styles>'
  );
}

function ensureTempPath(outPath?: string) {
  if (outPath) {
    return outPath;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dued8-docx-'));
  return path.join(tempDir, 'deliverable.docx');
}

export async function renderDocx(d: Deliverable, outPath?: string) {
  const encoder = new TextEncoder();
  const paragraphs: string[] = [];
  if (d.title) {
    paragraphs.push(paragraphXml(lintDeliverableText(d.title), 'Heading1'));
  }
  for (const section of d.sections) {
    if (section.heading) {
      paragraphs.push(paragraphXml(lintDeliverableText(section.heading), 'Heading2'));
    }
    paragraphs.push(paragraphXml(lintDeliverableText(section.body), 'Normal'));
  }
  if (d.references?.length) {
    paragraphs.push(paragraphXml('References', 'Heading2'));
    for (const ref of d.references) {
      paragraphs.push(paragraphXml(lintDeliverableText(ref), 'Normal'));
    }
  }

  const body = paragraphs.join('');
  const documentXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ' +
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:v="urn:schemas-microsoft-com:vml" ' +
    'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
    'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" ' +
    'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" ' +
    'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">' +
    '<w:body>' +
    body +
    '<w:sectPr>' +
    '<w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
    '</w:sectPr>' +
    '</w:body>' +
    '</w:document>';

  const relationships =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const documentRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '</Types>';

  const zipBytes = createStoredZip([
    { name: '_rels/.rels', data: encoder.encode(relationships) },
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(documentRels) },
    { name: 'word/styles.xml', data: encoder.encode(stylesXml()) }
  ]);

  const target = ensureTempPath(outPath);
  fs.writeFileSync(target, zipBytes);
  return { buffer: Buffer.from(zipBytes), path: target };
}
