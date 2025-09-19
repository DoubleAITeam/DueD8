const HeadingLevel = {
  HEADING_1: 'Heading1',
  HEADING_2: 'Heading2',
  HEADING_3: 'Heading3'
};

class TextRun {
  constructor(textOrOptions) {
    if (typeof textOrOptions === 'string') {
      this.text = textOrOptions;
    } else {
      this.text = textOrOptions?.text ?? '';
    }
  }

  getText() {
    return String(this.text ?? '');
  }
}

class Paragraph {
  constructor(options = {}) {
    this.heading = options.heading ?? null;
    this.text = typeof options.text === 'string' ? options.text : null;
    this.children = Array.isArray(options.children)
      ? options.children.map((child) => (child instanceof TextRun ? child : new TextRun(child)))
      : [];
  }

  getRuns() {
    if (this.children.length) {
      return this.children;
    }
    return [new TextRun(this.text ?? '')];
  }
}

class Document {
  constructor(_options = {}) {
    this.sections = [];
  }

  addSection(section) {
    if (section && Array.isArray(section.children)) {
      this.sections.push(section.children);
    }
  }

  getParagraphs() {
    return this.sections.flat();
  }
}

function escapeXml(input) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createParagraphXml(paragraph) {
  const runs = paragraph.getRuns();
  const encodedRuns = runs
    .map((run, index) => {
      const text = escapeXml(run.getText());
      if (!text.length) {
        return '<w:r><w:t/></w:r>';
      }
      const normalized = text.replace(/\r\n|\r|\n/g, '\n');
      const segments = normalized.split('\n');
      return segments
        .map((segment, segIndex) => {
          const safe = segment.length ? `<w:t>${segment}</w:t>` : '<w:t/>';
          if (segIndex === 0 && index === 0) {
            return `<w:r>${safe}</w:r>`;
          }
          return `<w:r>${segIndex === 0 ? '' : '<w:br/>'}${safe}</w:r>`;
        })
        .join('');
    })
    .join('');
  const heading = paragraph.heading;
  if (heading === HeadingLevel.HEADING_1 || heading === HeadingLevel.HEADING_2 || heading === HeadingLevel.HEADING_3) {
    return `<w:p><w:pPr><w:pStyle w:val="${heading}"/></w:pPr>${encodedRuns}</w:p>`;
  }
  return `<w:p>${encodedRuns}</w:p>`;
}

function crc32(data) {
  const table = crc32.table || (crc32.table = (() => {
    const tbl = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) {
        c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      tbl[n] = c >>> 0;
    }
    return tbl;
  })());
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function concatUint8Arrays(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createStoredZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
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

class Packer {
  static async toBuffer(document) {
    const encoder = new TextEncoder();
    const paragraphs = document.getParagraphs();
    const bodyXml = paragraphs.map(createParagraphXml).join('');
    const documentXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:wpc="http://schemas.microsoft.com/office/2010/wordprocessingCanvas" ' +
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
      'xmlns:wne="http://schemas.microsoft.com/office/2006/wordml" ' +
      'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">' +
      '<w:body>' +
      bodyXml +
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

    const contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>';

    const zipBytes = createStoredZip([
      { name: '_rels/.rels', data: encoder.encode(relationships) },
      { name: '[Content_Types].xml', data: encoder.encode(contentTypes) },
      { name: 'word/document.xml', data: encoder.encode(documentXml) }
    ]);

    return Buffer.from(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  }
}

module.exports = {
  Document,
  HeadingLevel,
  Paragraph,
  TextRun,
  Packer
};
