export type DocumentFormatting = {
  fontFamily: string;
  fontSize: number;
  lineSpacing: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
};

export const DEFAULT_DOCUMENT_FORMATTING: DocumentFormatting = {
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineSpacing: 2,
  margins: { top: 1, right: 1, bottom: 1, left: 1 }
};

type GenerateDocxOptions = {
  content: string;
  formatting?: DocumentFormatting;
};

type GeneratePdfOptions = {
  content: string;
  formatting?: DocumentFormatting;
};

export type SubmissionContext = { fileName: string; content: string };

export type SubmissionAttachment = { name: string; url?: string | null };

export type GeneratedSubmission = {
  plainText: string;
  formatting: DocumentFormatting;
  citationStyle: string;
  references: string[];
  needsSources: boolean;
  warnings: string[];
  upgradeGate: { completed: number; total: number } | null;
  headerIncluded: boolean;
  deliverableType: string;
};

export type BuildSolutionContentOptions = {
  assignmentName?: string | null;
  courseName?: string;
  dueText?: string;
  contexts: SubmissionContext[];
  canvasLink?: string | null;
  attachments?: SubmissionAttachment[];
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

function inchesToTwips(value: number) {
  return Math.round(value * 1440);
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

function createDocxParagraphs(content: string, formatting: DocumentFormatting) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return '<w:p><w:r><w:t/></w:r></w:p>';
  }

  const font = formatting.fontFamily || DEFAULT_DOCUMENT_FORMATTING.fontFamily;
  const size = Math.max(8, Math.min(18, formatting.fontSize || DEFAULT_DOCUMENT_FORMATTING.fontSize));
  const sizeHalfPoints = Math.round(size * 2);
  const line = Math.max(1, formatting.lineSpacing || DEFAULT_DOCUMENT_FORMATTING.lineSpacing);
  const lineTwips = Math.round(line * 240);

  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.split(/\n+/).map((line) => escapeXml(line));
      if (!lines.length) {
        return '<w:p><w:r><w:t/></w:r></w:p>';
      }
      const runProps =
        `<w:rPr>` +
        `<w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}" w:cs="${escapeXml(font)}"/>` +
        `<w:sz w:val="${sizeHalfPoints}"/><w:szCs w:val="${sizeHalfPoints}"/>` +
        '</w:rPr>';
      const paragraphProps =
        '<w:pPr>' +
        `<w:spacing w:line="${lineTwips}" w:lineRule="auto"/>` +
        `<w:rPr><w:rFonts w:ascii="${escapeXml(font)}" w:hAnsi="${escapeXml(font)}" w:cs="${escapeXml(font)}"/>` +
        `<w:sz w:val="${sizeHalfPoints}"/><w:szCs w:val="${sizeHalfPoints}"/></w:rPr>` +
        '</w:pPr>';
      const runs = lines
        .map((line, index) =>
          index === 0
            ? `<w:r>${runProps}<w:t xml:space="preserve">${line}</w:t></w:r>`
            : `<w:r>${runProps}<w:br/><w:t xml:space="preserve">${line}</w:t></w:r>`
        )
        .join('');
      return `<w:p>${paragraphProps}${runs}</w:p>`;
    })
    .join('');
}

async function generateDocx({ content, formatting }: GenerateDocxOptions): Promise<ArtifactResult> {
  const encoder = new TextEncoder();
  const config = formatting ?? DEFAULT_DOCUMENT_FORMATTING;
  const margins = config.margins ?? DEFAULT_DOCUMENT_FORMATTING.margins;
  const marginTop = inchesToTwips(margins.top ?? DEFAULT_DOCUMENT_FORMATTING.margins.top);
  const marginRight = inchesToTwips(margins.right ?? DEFAULT_DOCUMENT_FORMATTING.margins.right);
  const marginBottom = inchesToTwips(margins.bottom ?? DEFAULT_DOCUMENT_FORMATTING.margins.bottom);
  const marginLeft = inchesToTwips(margins.left ?? DEFAULT_DOCUMENT_FORMATTING.margins.left);

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

  const documentBody = createDocxParagraphs(content, config);
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
    `<w:pgMar w:top="${marginTop}" w:right="${marginRight}" w:bottom="${marginBottom}" w:left="${marginLeft}" w:header="720" w:footer="720" w:gutter="0"/>` +
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

function generatePdfStream(content: string, formatting: DocumentFormatting) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const operations: string[] = [];
  operations.push('BT');
  const fontSize = Math.max(8, Math.min(18, formatting.fontSize || DEFAULT_DOCUMENT_FORMATTING.fontSize));
  const leading = Math.max(10, Math.round(fontSize * (formatting.lineSpacing || DEFAULT_DOCUMENT_FORMATTING.lineSpacing) * 12) / 12);
  operations.push(`/F1 ${fontSize} Tf`);
  operations.push('72 720 Td');
  lines.forEach((line, index) => {
    const escaped = escapePdf(line.length ? line : ' ');
    operations.push(`(${escaped}) Tj`);
    if (index < lines.length - 1) {
      operations.push(`0 -${leading.toFixed(2)} Td`);
    }
  });
  operations.push('ET');
  return operations.join('\n');
}

function generatePdf({ content, formatting }: GeneratePdfOptions): ArtifactResult {
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

  const streamContent = generatePdfStream(content, formatting ?? DEFAULT_DOCUMENT_FORMATTING);
  const streamLength = encoder.encode(streamContent).length;

  offsets[4] = length;
  append(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n`);
  append(`${streamContent}\n`);
  append('endstream\nendobj\n');

  offsets[5] = length;
  append('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>\nendobj\n');

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
  formatting?: DocumentFormatting;
}): Promise<ArtifactResult> {
  if (options.extension === 'pdf') {
    return generatePdf({ content: options.content, formatting: options.formatting });
  }
  if (options.extension === 'docx') {
    return generateDocx({ content: options.content, formatting: options.formatting });
  }
  throw new Error(`Unsupported artifact extension: ${options.extension}`);
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'will',
  'should',
  'would',
  'could',
  'about',
  'into',
  'your',
  'their',
  'there',
  'such',
  'each',
  'within',
  'between',
  'include',
  'including',
  'assignment',
  'students',
  'student',
  'question',
  'questions',
  'answer',
  'answers',
  'points',
  'using',
  'use',
  'write',
  'writing',
  'paper',
  'essay',
  'provide',
  'provided',
  'describe',
  'explain',
  'analysis',
  'analyze',
  'based',
  'least',
  'per',
  'cent',
  'due',
  'submit',
  'submission',
  'complete',
  'completing',
  'deliverable',
  'must',
  'needs',
  'need',
  'make',
  'ensure',
  'create',
  'prepare',
  'outline',
  'topic',
  'topics',
  'rubric',
  'criteria',
  'instructions',
  'guidelines',
  'format',
  'formats',
  'pages',
  'page',
  'words',
  'word',
  'length'
]);

type ParsedPrompt = {
  displayLabel: string;
  label: string;
  prompt: string;
  subparts: ParsedPrompt[];
  isProblem: boolean;
};

function extractKeywords(text: string, limit = 10) {
  const counts = new Map<string, number>();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, limit);
}

function capitaliseKeyword(word: string) {
  if (!word) {
    return 'Topic';
  }
  if (/^[0-9]+$/.test(word)) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function createHeadingFromPrompt(prompt: string) {
  const trimmed = prompt.replace(/\s+/g, ' ').trim();
  const patterns: Array<{ test: RegExp; replace: string }> = [
    { test: /^explain\b/i, replace: 'Explanation of ' },
    { test: /^describe\b/i, replace: 'Description of ' },
    { test: /^discuss\b/i, replace: 'Discussion of ' },
    { test: /^identify\b/i, replace: 'Identification of ' },
    { test: /^analy[sz]e\b/i, replace: 'Analysis of ' },
    { test: /^compare\b/i, replace: 'Comparison of ' },
    { test: /^evaluate\b/i, replace: 'Evaluation of ' },
    { test: /^outline\b/i, replace: 'Outline of ' },
    { test: /^summari[sz]e\b/i, replace: 'Summary of ' }
  ];
  for (const pattern of patterns) {
    if (pattern.test.test(trimmed)) {
      const remainder = trimmed.replace(pattern.test, '').replace(/^[\s:]+/, '').replace(/[.:!?]+$/, '');
      return `${pattern.replace}${remainder}`.trim();
    }
  }
  return trimmed.replace(/[.:!?]+$/, '').replace(/^./, (char) => char.toUpperCase());
}

function listAspects(items: string[]) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) {
    return '';
  }
  if (filtered.length === 2) {
    return `${filtered[0]} and ${filtered[1]}`;
  }
  if (filtered.length === 1) {
    return filtered[0];
  }
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`;
}

function isProblemPrompt(text: string) {
  return /(calculate|solve|equation|formula|determin|compute|rounded|show your work|probability|statistic|derive|graph)/i.test(
    text
  );
}

function parsePromptsFromText(text: string) {
  const prompts: ParsedPrompt[] = [];
  const rubric: string[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  let current: ParsedPrompt | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line.length) {
      continue;
    }

    if (/rubric/i.test(line) || /points/i.test(line) || /criteria/i.test(line) || /^[-•]/.test(line)) {
      rubric.push(line.replace(/^[-•]\s*/, ''));
    }

    const questionMatch = line.match(/^(\d+(?:\.\d+)*)\s*([).:-])\s+(.*)$/);
    if (questionMatch) {
      const promptText = questionMatch[3].trim();
      current = {
        displayLabel: `${questionMatch[1]}${questionMatch[2]}`,
        label: questionMatch[1],
        prompt: promptText,
        subparts: [],
        isProblem: isProblemPrompt(promptText)
      };
      prompts.push(current);
      continue;
    }

    const letterMatch = line.match(/^([a-zA-Z])\s*([).:-])\s+(.*)$/);
    if (letterMatch && current) {
      const promptText = letterMatch[3].trim();
      current.subparts.push({
        displayLabel: `${letterMatch[1]}${letterMatch[2]}`,
        label: letterMatch[1],
        prompt: promptText,
        subparts: [],
        isProblem: isProblemPrompt(promptText)
      });
      continue;
    }

    const romanMatch = line.match(/^((?:[ivxlcdm]+))\s*([).:-])\s+(.*)$/i);
    if (romanMatch && current) {
      const promptText = romanMatch[3].trim();
      current.subparts.push({
        displayLabel: `${romanMatch[1]}${romanMatch[2]}`,
        label: romanMatch[1],
        prompt: promptText,
        subparts: [],
        isProblem: isProblemPrompt(promptText)
      });
    }
  }

  return { prompts, rubric };
}

function detectFormattingFromText(contexts: SubmissionContext[]): DocumentFormatting {
  const base: DocumentFormatting = {
    fontFamily: DEFAULT_DOCUMENT_FORMATTING.fontFamily,
    fontSize: DEFAULT_DOCUMENT_FORMATTING.fontSize,
    lineSpacing: DEFAULT_DOCUMENT_FORMATTING.lineSpacing,
    margins: { ...DEFAULT_DOCUMENT_FORMATTING.margins }
  };
  const joined = contexts.map((entry) => entry.content).join('\n').toLowerCase();
  if (/calibri/.test(joined)) {
    base.fontFamily = 'Calibri';
  } else if (/arial/.test(joined)) {
    base.fontFamily = 'Arial';
  } else if (/garamond/.test(joined)) {
    base.fontFamily = 'Garamond';
  }

  if (/single[- ]spaced/.test(joined)) {
    base.lineSpacing = 1;
  } else if (/1\.5\s*(?:line|spacing)/.test(joined)) {
    base.lineSpacing = 1.5;
  } else if (/double[- ]spaced/.test(joined)) {
    base.lineSpacing = 2;
  }

  const sizeMatch = joined.match(/(1[0-4]|9|11)\s*(?:pt|point)/);
  if (sizeMatch) {
    base.fontSize = Number.parseInt(sizeMatch[1], 10);
  }

  const marginMatch = joined.match(/(\d(?:\.\d+)?)\s*(?:inch|in\.)\s*margins/);
  if (marginMatch) {
    const margin = Number.parseFloat(marginMatch[1]);
    if (!Number.isNaN(margin)) {
      base.margins = { top: margin, right: margin, bottom: margin, left: margin };
    }
  }

  return base;
}

function detectHeaderRequirement(text: string) {
  const tokens = ['name', 'course', 'instructor', 'date'];
  let matches = 0;
  for (const token of tokens) {
    if (new RegExp(`${token}\\s*(?:line|:)`, 'i').test(text) || new RegExp(`include\\s+your\\s+${token}`, 'i').test(text)) {
      matches += 1;
    }
  }
  return matches >= 2;
}

function detectCitationStyle(text: string) {
  if (/apa\s*7/i.test(text) || /apa/i.test(text)) {
    return 'APA 7';
  }
  if (/mla\s*9/i.test(text) || /mla/i.test(text)) {
    return 'MLA 9';
  }
  if (/chicago|turabian/i.test(text)) {
    return 'Chicago Notes-Bibliography';
  }
  if (/ieee/i.test(text)) {
    return 'IEEE';
  }
  if (/harvard/i.test(text)) {
    return 'Harvard';
  }
  if (/asa/i.test(text)) {
    return 'ASA';
  }
  return 'APA 7';
}

function detectDeliverableType(text: string) {
  const lower = text.toLowerCase();
  if (/problem set|worksheet|short answer|questions?\b/.test(lower)) {
    return 'Problem Set';
  }
  if (/lab report|experiment|lab\b/.test(lower)) {
    return 'Lab Report';
  }
  if (/presentation|slides|deck/.test(lower)) {
    return 'Presentation Outline';
  }
  if (/reflection/.test(lower)) {
    return 'Reflection';
  }
  if (/case study/.test(lower)) {
    return 'Case Study';
  }
  if (/memo/.test(lower)) {
    return 'Memo';
  }
  if (/essay|paper/.test(lower)) {
    return 'Essay';
  }
  return 'Written Response';
}

function rewriteRubricLine(line: string) {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  if (!cleaned.length) {
    return '';
  }
  const withoutPoints = cleaned.replace(/\b\d+\s*points?\b/gi, '').trim();
  const normalised = withoutPoints.replace(/[:;]+$/, '');
  return `Meet the expectation for ${normalised}.`;
}

function composeNarrativeForPrompt(prompt: ParsedPrompt, globalKeywords: string[]) {
  const promptKeywords = extractKeywords(prompt.prompt, 6);
  const combined: string[] = [];
  for (const keyword of [...promptKeywords, ...globalKeywords]) {
    if (!combined.includes(keyword)) {
      combined.push(keyword);
    }
  }
  const heading = createHeadingFromPrompt(prompt.prompt);
  const baseWord = combined[0] ?? prompt.prompt.split(' ')[0] ?? 'topic';
  const focus = capitaliseKeyword(baseWord);
  const supporting = combined.slice(1, 4).map(capitaliseKeyword);
  const info = prompt.prompt.toLowerCase();

  if (prompt.isProblem) {
    const steps = [
      `Step 1: Interpret ${focus} by restating the question in course language${
        supporting.length ? `, centring ${listAspects(supporting)}` : ''
      }.`,
      'Step 2: Apply the correct process carefully, documenting any conversions or intermediate work.',
      'Step 3: Verify the reasoning against class examples to confirm precision.'
    ];
    const finalLine = `Final Answer: ${focus} is resolved with clear justification and appropriate units.`;
    return { heading, paragraphs: steps, finalLine };
  }

  const sentences: string[] = [];
  if (info.includes('compare') && info.includes('contrast')) {
    sentences.push(`${focus} is weighed against ${supporting.length ? listAspects(supporting) : 'related elements'} to highlight key distinctions.`);
    sentences.push('The balanced comparison connects similarities and differences directly to course objectives.');
  } else if (/(explain|why|analy[sz]e)/i.test(info)) {
    sentences.push(`${focus} is interpreted by linking causes and effects drawn from lectures and readings.`);
    sentences.push(
      supporting.length
        ? `Evidence foregrounds ${listAspects(supporting)}, which together clarify the underlying reasoning.`
        : 'The explanation integrates assigned sources to keep the logic grounded.'
    );
  } else if (/(describe|outline|summari[sz]e)/i.test(info)) {
    sentences.push(`${focus} is described with concrete details and precise terminology.`);
    sentences.push(
      supporting.length
        ? `Examples cover ${listAspects(supporting)} so the narrative feels complete.`
        : 'The description remains concise while still satisfying rubric expectations.'
    );
  } else {
    sentences.push(`${focus} is developed into a clear argument that stays aligned with the assignment goals.`);
    sentences.push(
      supporting.length
        ? `Supporting ideas reference ${listAspects(supporting)} to maintain cohesion.`
        : 'Course insights are blended with thoughtful interpretation in a polished student voice.'
    );
  }

  return { heading, paragraphs: sentences };
}

function indentLines(lines: string[], indent = '    ') {
  return lines.map((line) => `${indent}${line}`);
}

export function buildSolutionContent(options: BuildSolutionContentOptions): GeneratedSubmission {
  const { assignmentName, courseName, dueText, contexts, canvasLink, attachments } = options;
  const formatting = detectFormattingFromText(contexts);
  const combinedTextRaw = contexts.map((entry) => entry.content).join('\n\n');
  const combinedText = combinedTextRaw.trim().length
    ? combinedTextRaw
    : [assignmentName ?? '', courseName ?? '', dueText ?? ''].filter(Boolean).join('\n');
  const { prompts, rubric } = parsePromptsFromText(combinedText);
  const globalKeywords = extractKeywords(combinedText, 12);
  const citationStyle = detectCitationStyle(combinedText);
  const deliverableType = detectDeliverableType(combinedText);
  const headerRequired = detectHeaderRequirement(combinedText);

  const sections: string[] = [];
  const headerLines: string[] = [];
  if (headerRequired) {
    headerLines.push('Name: ____________________');
    headerLines.push(`Course: ${courseName?.trim().length ? courseName.trim() : '____________________'}`);
    headerLines.push('Instructor: ____________________');
    headerLines.push('Date: ____________________');
  }
  if (headerLines.length) {
    sections.push(headerLines.join('\n'));
  }

  const cleanTitle = assignmentName?.trim().length ? assignmentName.trim() : 'Submission';
  sections.push(cleanTitle);
  sections.push(`Deliverable format: ${deliverableType}`);
  if (dueText?.trim().length) {
    sections.push(`Due: ${dueText.trim()}`);
  }

  const bodyParts: string[] = [];
  const promptLimit = 6;
  let upgradeGate: { completed: number; total: number } | null = null;

  if (prompts.length) {
    const total = prompts.length;
    const availablePrompts = total > promptLimit ? prompts.slice(0, promptLimit) : prompts;
    if (total > promptLimit) {
      upgradeGate = { completed: availablePrompts.length, total };
    }

    availablePrompts.forEach((prompt) => {
      const narrative = composeNarrativeForPrompt(prompt, globalKeywords);
      const blockLines: string[] = [];
      blockLines.push(`${prompt.displayLabel} ${narrative.heading}`);
      blockLines.push(...narrative.paragraphs);
      if (narrative.finalLine) {
        blockLines.push(narrative.finalLine);
      }
      prompt.subparts.forEach((sub) => {
        const subNarrative = composeNarrativeForPrompt(sub, globalKeywords);
        blockLines.push(`  ${sub.displayLabel} ${subNarrative.heading}`);
        blockLines.push(...indentLines(subNarrative.paragraphs));
        if (subNarrative.finalLine) {
          blockLines.push(`  ${subNarrative.finalLine}`);
        }
      });
      bodyParts.push(blockLines.join('\n'));
    });
  } else {
    const keywords = globalKeywords.length ? globalKeywords : extractKeywords(cleanTitle, 6);
    const focus = capitaliseKeyword(keywords[0] ?? cleanTitle);
    const supporting = keywords.slice(1, 4).map(capitaliseKeyword);
    const introduction = `${focus} anchors the response by outlining the central goals of the assignment.`;
    const development = supporting.length
      ? `The body develops ${listAspects(supporting)} with polished explanations that mirror the requested structure.`
      : 'The body develops key ideas with polished explanations that mirror the requested structure.';
    const conclusion = 'The submission closes the loop by reaffirming how the work satisfies every required checkpoint.';
    bodyParts.push(`Introduction\n${introduction}`);
    bodyParts.push(`Body\n${development}`);
    bodyParts.push(`Conclusion\n${conclusion}`);
  }

  if (rubric.length) {
    const seen = new Set<string>();
    const rubricNotes = rubric
      .map((entry) => rewriteRubricLine(entry))
      .filter((entry) => entry.length && !seen.has(entry))
      .map((entry) => {
        seen.add(entry);
        return entry;
      });
    if (rubricNotes.length) {
      bodyParts.push(['Rubric checkpoints', ...rubricNotes].join('\n'));
    }
  }

  sections.push(...bodyParts);

  const references: string[] = [];
  const referenceSources = attachments?.length
    ? attachments
    : contexts.slice(0, 3).map((entry) => ({ name: entry.fileName, url: null }));
  referenceSources.forEach((source) => {
    if (!source?.name) {
      return;
    }
    if (source.url) {
      references.push(`${source.name}. Retrieved from ${source.url}`);
    } else {
      references.push(`${source.name}. [SOURCE NEEDED]`);
    }
  });

  let needsSources = false;
  if (!references.length) {
    references.push('[SOURCE NEEDED]');
    needsSources = true;
  } else if (references.some((ref) => ref.includes('[SOURCE NEEDED]'))) {
    needsSources = true;
  }

  sections.push('References');
  sections.push(references.map((ref, index) => `${index + 1}. ${ref}`).join('\n'));

  const resourceLines: string[] = [];
  if (canvasLink) {
    resourceLines.push(`Canvas assignment: ${canvasLink}`);
  }
  (attachments ?? []).forEach((attachment) => {
    if (attachment?.url) {
      resourceLines.push(`${attachment.name}: ${attachment.url}`);
    }
  });
  if (resourceLines.length) {
    sections.push('Resources');
    sections.push(resourceLines.join('\n'));
  }

  const warnings: string[] = [];
  if (needsSources) {
    warnings.push('Sources missing');
  }
  if (upgradeGate) {
    warnings.push('Submission truncated for free tier');
  }

  return {
    plainText: sections.join('\n\n'),
    formatting,
    citationStyle,
    references,
    needsSources,
    warnings,
    upgradeGate,
    headerIncluded: headerLines.length > 0,
    deliverableType
  };
}
