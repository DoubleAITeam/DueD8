import type { SubmissionDocument, SubmissionFormatting } from './submissionFormatter';

type GeneratorPayload = {
  paragraphs: string[];
  formatting: SubmissionFormatting;
};

type GenerateDocxOptions = GeneratorPayload;

type GeneratePdfOptions = GeneratorPayload;

type ArtifactResult = {
  blob: Blob;
  mimeType: string;
};

const DEFAULT_FORMATTING: SubmissionFormatting = {
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 'double',
  marginInches: 1,
  fontColor: '#000000'
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function concatUint8Arrays(parts: Uint8Array[]) {
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
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    const localHeader = new Uint8Array(30 + fileNameBytes.length);
    const localView = new DataView(localHeader.buffer);
    let cursor = 0;
    localView.setUint32(cursor, 0x04034b50, true);
    cursor += 4;
    localView.setUint16(cursor, 20, true);
    cursor += 2;
    localView.setUint16(cursor, 0, true);
    cursor += 2;
    localView.setUint16(cursor, 0, true);
    cursor += 2;
    localView.setUint16(cursor, 0, true);
    cursor += 2;
    localView.setUint16(cursor, 0, true);
    cursor += 2;
    localView.setUint32(cursor, crc, true);
    cursor += 4;
    localView.setUint32(cursor, size, true);
    cursor += 4;
    localView.setUint32(cursor, size, true);
    cursor += 4;
    localView.setUint16(cursor, fileNameBytes.length, true);
    cursor += 2;
    localView.setUint16(cursor, 0, true);
    cursor += 2;
    localHeader.set(fileNameBytes, 30);

    localParts.push(localHeader);
    localParts.push(data);

    const centralHeader = new Uint8Array(46 + fileNameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    cursor = 0;
    centralView.setUint32(cursor, 0x02014b50, true);
    cursor += 4;
    centralView.setUint16(cursor, 20, true);
    cursor += 2;
    centralView.setUint16(cursor, 20, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint32(cursor, crc, true);
    cursor += 4;
    centralView.setUint32(cursor, size, true);
    cursor += 4;
    centralView.setUint32(cursor, size, true);
    cursor += 4;
    centralView.setUint16(cursor, fileNameBytes.length, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint16(cursor, 0, true);
    cursor += 2;
    centralView.setUint32(cursor, 0, true);
    cursor += 4;
    centralView.setUint32(cursor, offset, true);
    cursor += 4;
    centralHeader.set(fileNameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralDir = concatUint8Arrays(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  let idx = 0;
  endView.setUint32(idx, 0x06054b50, true);
  idx += 4;
  endView.setUint16(idx, 0, true);
  idx += 2;
  endView.setUint16(idx, 0, true);
  idx += 2;
  endView.setUint16(idx, entries.length, true);
  idx += 2;
  endView.setUint16(idx, entries.length, true);
  idx += 2;
  endView.setUint32(idx, centralDir.length, true);
  idx += 4;
  endView.setUint32(idx, offset, true);
  idx += 4;
  endView.setUint16(idx, 0, true);

  const zipBody = concatUint8Arrays([...localParts, centralDir, endRecord]);
  return zipBody;
}

function escapeXml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hexColour(value: string) {
  return value.replace('#', '').padStart(6, '0').slice(0, 6).toUpperCase();
}

function createDocxParagraphs(paragraphs: string[], formatting: SubmissionFormatting) {
  if (!paragraphs.length) {
    return '<w:p><w:r><w:t/></w:r></w:p>';
  }

  const spacing =
    formatting.lineSpacing === 'double'
      ? 480
      : formatting.lineSpacing === 'one-and-half'
        ? 360
        : 240;
  const fontName = escapeXml(formatting.fontFamily);
  const fontSize = Math.max(2, Math.round(formatting.fontSize * 2));
  const colour = hexColour(formatting.fontColor);

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.split(/\n/);
      if (!lines.length) {
        return `<w:p><w:pPr><w:spacing w:line="${spacing}" w:lineRule="auto"/></w:pPr></w:p>`;
      }
      const runs = lines
        .map((line, index) => {
          const escaped = escapeXml(line);
          const breakTag = index === 0 ? '' : '<w:br/>';
          return (
            `<w:r><w:rPr>` +
            `<w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/>` +
            `<w:sz w:val="${fontSize}"/>` +
            `<w:color w:val="${colour}"/>` +
            `</w:rPr>${breakTag}<w:t xml:space="preserve">${escaped}</w:t></w:r>`
          );
        })
        .join('');
      return `<w:p><w:pPr><w:spacing w:line="${spacing}" w:lineRule="auto"/></w:pPr>${runs}</w:p>`;
    })
    .join('');
}

async function generateDocx({ paragraphs, formatting }: GenerateDocxOptions): Promise<ArtifactResult> {
  const encoder = new TextEncoder();

  const relationships =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  const documentBody = createDocxParagraphs(paragraphs, formatting);
  const margin = Math.round(Math.max(0.5, formatting.marginInches) * 1440);
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
    documentBody +
    '<w:sectPr>' +
    '<w:pgSz w:w="12240" w:h="15840"/>' +
    `<w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/>` +
    '</w:sectPr>' +
    '</w:body>' +
    '</w:document>';

  const zipBytes = createStoredZip([
    { name: '_rels/.rels', data: encoder.encode(relationships) },
    { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
    { name: 'word/document.xml', data: encoder.encode(documentXml) }
  ]);

  return {
    blob: new Blob([zipBytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
}

function escapePdf(input: string) {
  return input.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function rgbFromHex(value: string) {
  const hex = value.replace('#', '').padStart(6, '0');
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function generatePdfStream(paragraphs: string[], formatting: SubmissionFormatting) {
  const operations: string[] = [];
  operations.push('BT');
  const colour = rgbFromHex(formatting.fontColor);
  operations.push(`${(colour.r / 255).toFixed(3)} ${(colour.g / 255).toFixed(3)} ${(colour.b / 255).toFixed(3)} rg`);
  operations.push(`/F1 ${formatting.fontSize} Tf`);
  const margin = Math.max(0.5, formatting.marginInches) * 72;
  const pageHeight = 792;
  const startY = pageHeight - margin;
  operations.push(`${margin.toFixed(2)} ${startY.toFixed(2)} Td`);
  const lineAdvance =
    formatting.lineSpacing === 'double'
      ? formatting.fontSize * 2
      : formatting.lineSpacing === 'one-and-half'
        ? formatting.fontSize * 1.5
        : formatting.fontSize * 1.2;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const lines = paragraph.replace(/\r\n/g, '\n').split('\n');
    lines.forEach((line, lineIndex) => {
      const escaped = escapePdf(line.length ? line : ' ');
      operations.push(`(${escaped}) Tj`);
      if (lineIndex < lines.length - 1) {
        operations.push(`0 -${lineAdvance.toFixed(2)} Td`);
      }
    });
    if (paragraphIndex < paragraphs.length - 1) {
      operations.push(`0 -${lineAdvance.toFixed(2)} Td`);
    }
  });
  operations.push('ET');
  return operations.join('\n');
}

function generatePdf({ paragraphs, formatting }: GeneratePdfOptions): ArtifactResult {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  const offsets: number[] = [];
  let length = 0;

  const append = (chunk: string) => {
    parts.push(chunk);
    length += encoder.encode(chunk).length;
  };

  append('%PDF-1.4\n');

  offsets[1] = length;
  append('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = length;
  append('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  offsets[3] = length;
  append(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );

  const streamContent = generatePdfStream(paragraphs, formatting);
  const streamLength = encoder.encode(streamContent).length;

  offsets[4] = length;
  append(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n`);
  append(`${streamContent}\n`);
  append('endstream\nendobj\n');

  offsets[5] = length;
  append('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  const xrefOffset = length;
  append('xref\n');
  append('0 6\n');
  append('0000000000 65535 f \n');
  for (let i = 1; i <= 5; i += 1) {
    const offset = offsets[i] ?? 0;
    append(`${offset.toString().padStart(10, '0')} 00000 n \n`);
  }
  append('trailer\n');
  append('<< /Size 6 /Root 1 0 R >>\n');
  append(`startxref\n${xrefOffset}\n`);
  append('%%EOF');

  const pdfBytes = encoder.encode(parts.join(''));
  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    mimeType: 'application/pdf'
  };
}

function paragraphsFromContent(content: string) {
  const segments = content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length);
  return segments.length ? segments : [''];
}

function paragraphsFromDocument(document: SubmissionDocument) {
  const paragraphs: string[] = [];
  if (document.headerLines.length) {
    paragraphs.push(...document.headerLines);
    paragraphs.push('');
  }
  paragraphs.push(...document.paragraphs);
  if (document.references.length) {
    paragraphs.push('');
    paragraphs.push(`References (${document.citationStyle})`);
    paragraphs.push(...document.references);
  }
  if (document.canvasLink) {
    paragraphs.push('');
    paragraphs.push(`Original assignment: ${document.canvasLink}`);
  }
  document.attachmentLinks.forEach((attachment) => {
    paragraphs.push(`Attachment: ${attachment.name}${attachment.url ? ` – ${attachment.url}` : ''}`);
  });
  return paragraphs.length ? paragraphs : [''];
}

type SolutionArtifactOptions =
  | { extension: 'pdf' | 'docx'; content: string }
  | { extension: 'pdf' | 'docx'; document: SubmissionDocument };

export async function createSolutionArtifact(options: SolutionArtifactOptions): Promise<ArtifactResult> {
  if ('document' in options) {
    const payload: GeneratorPayload = {
      paragraphs: paragraphsFromDocument(options.document),
      formatting: options.document.formatting
    };
    if (options.extension === 'pdf') {
      return generatePdf(payload);
    }
    if (options.extension === 'docx') {
      return generateDocx(payload);
    }
    throw new Error(`Unsupported artifact extension: ${options.extension}`);
  }

  const payload: GeneratorPayload = {
    paragraphs: paragraphsFromContent(options.content),
    formatting: DEFAULT_FORMATTING
  };

  if (options.extension === 'pdf') {
    return generatePdf(payload);
  }
  if (options.extension === 'docx') {
    return generateDocx(payload);
  }
  throw new Error(`Unsupported artifact extension: ${options.extension}`);
}

export async function createSubmissionArtifacts(document: SubmissionDocument) {
  const payload: GeneratorPayload = {
    paragraphs: paragraphsFromDocument(document),
    formatting: document.formatting
  };
  const [docx, pdf] = await Promise.all([generateDocx(payload), generatePdf(payload)]);
  return { docx, pdf, paragraphs: payload.paragraphs };
}
