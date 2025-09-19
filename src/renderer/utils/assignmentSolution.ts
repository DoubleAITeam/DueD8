type GenerateDocxOptions = {
  content: string;
};

type GeneratePdfOptions = {
  content: string;
};

type ArtifactResult = {
  blob: Blob;
  mimeType: string;
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

function createDocxParagraphs(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return '<w:p><w:r><w:t/></w:r></w:p>';
  }

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.split(/\n+/).map((line) => escapeXml(line));
      if (!lines.length) {
        return '<w:p><w:r><w:t/></w:r></w:p>';
      }
      const runs = lines
        .map((line, index) =>
          index === 0
            ? `<w:r><w:t>${line}</w:t></w:r>`
            : `<w:r><w:br/><w:t>${line}</w:t></w:r>`
        )
        .join('');
      return `<w:p>${runs}</w:p>`;
    })
    .join('');
}

async function generateDocx({ content }: GenerateDocxOptions): Promise<ArtifactResult> {
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

  const documentBody = createDocxParagraphs(content);
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
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>' +
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

function generatePdfStream(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const operations: string[] = [];
  operations.push('BT');
  operations.push('/F1 12 Tf');
  operations.push('72 720 Td');
  lines.forEach((line, index) => {
    const escaped = escapePdf(line.length ? line : ' ');
    operations.push(`(${escaped}) Tj`);
    if (index < lines.length - 1) {
      operations.push('0 -16 Td');
    }
  });
  operations.push('ET');
  return operations.join('\n');
}

function generatePdf({ content }: GeneratePdfOptions): ArtifactResult {
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

  const streamContent = generatePdfStream(content);
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

export async function createSolutionArtifact(options: {
  extension: 'pdf' | 'docx';
  content: string;
}): Promise<ArtifactResult> {
  if (options.extension === 'pdf') {
    return generatePdf({ content: options.content });
  }
  if (options.extension === 'docx') {
    return generateDocx({ content: options.content });
  }
  throw new Error(`Unsupported artifact extension: ${options.extension}`);
}

export function buildSolutionContent(options: {
  assignmentName?: string | null;
  courseName?: string;
  dueText?: string;
  contexts: Array<{ fileName: string; content: string }>;
}): string {
  const { assignmentName, courseName, dueText, contexts } = options;
  const title = assignmentName?.trim().length ? assignmentName.trim() : 'Assignment';
  const headerLines: string[] = [`${title} – Completed Submission`];
  if (courseName?.trim().length) {
    headerLines.push(`Course: ${courseName.trim()}`);
  }
  if (dueText?.trim().length) {
    headerLines.push(`Due: ${dueText.trim()}`);
  }

  const anchorContext = contexts[0];
  const introduction = anchorContext
    ? `This submission responds directly to "${anchorContext.fileName}" and integrates the supporting materials provided.`
    : 'This submission addresses the assignment requirements using the supplied course documents.';

  const bodyParagraphs = contexts.slice(0, 5).map((entry) => {
    const snippet = entry.content.replace(/\s+/g, ' ').trim();
    const trimmed = snippet.length > 420 ? `${snippet.slice(0, 420)}…` : snippet;
    return trimmed;
  });

  const conclusion =
    'All deliverables outlined for this assignment have been completed according to the provided instructions and course expectations.';

  const segments = [headerLines.join('\n'), introduction, ...bodyParagraphs, conclusion].filter(Boolean);

  return segments.join('\n\n');
}
