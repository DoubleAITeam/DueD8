import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import type { ArtifactKind } from '../types';
import { getInsightsMaxBytes, getInsightsMaxPages } from './config';

export interface ParserResult {
  text?: string;
  title?: string;
  author?: string;
  detectedCourseId?: string;
  detectedAssignmentId?: string;
  pageCount?: number;
  warnings: string[];
}

const STOPWORDS = new Set(
  [
    'a',
    'about',
    'above',
    'after',
    'again',
    'against',
    'all',
    'am',
    'an',
    'and',
    'any',
    'are',
    'as',
    'at',
    'be',
    'because',
    'been',
    'before',
    'being',
    'below',
    'between',
    'both',
    'but',
    'by',
    'can',
    'could',
    'did',
    'do',
    'does',
    'doing',
    'down',
    'during',
    'each',
    'few',
    'for',
    'from',
    'further',
    'had',
    'has',
    'have',
    'having',
    'he',
    'her',
    'here',
    'hers',
    'herself',
    'him',
    'himself',
    'his',
    'how',
    'i',
    'if',
    'in',
    'into',
    'is',
    'it',
    "it's",
    'its',
    'itself',
    'just',
    'me',
    'more',
    'most',
    'my',
    'myself',
    'no',
    'nor',
    'not',
    'of',
    'off',
    'on',
    'once',
    'only',
    'or',
    'other',
    'our',
    'ours',
    'ourselves',
    'out',
    'over',
    'own',
    'same',
    'she',
    "she's",
    'should',
    'so',
    'some',
    'such',
    'than',
    'that',
    "that's",
    'the',
    'their',
    'theirs',
    'them',
    'themselves',
    'then',
    'there',
    'these',
    'they',
    'this',
    'those',
    'through',
    'to',
    'too',
    'under',
    'until',
    'up',
    'very',
    'was',
    'we',
    'were',
    'what',
    'when',
    'where',
    'which',
    'while',
    'who',
    'whom',
    'why',
    'with',
    'would',
    'you',
    'your',
    'yours',
    'yourself',
    'yourselves'
  ].map((word) => word.toLowerCase())
);

const COURSE_REGEX = /\b([A-Z]{2,4}-\d{3}-\d{3})\b/;
const ASSIGNMENT_REGEX = /\b([A-Z]\d+|P\d+)\b/;

function detectCourseId(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(COURSE_REGEX);
  return match ? match[1] : undefined;
}

function detectAssignmentId(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(ASSIGNMENT_REGEX);
  return match ? match[1] : undefined;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

async function readTextFileWithCaps(filePath: string): Promise<{ content?: string; warnings: string[] }> {
  const warnings: string[] = [];
  try {
    const fileStat = await stat(filePath);
    const maxBytes = getInsightsMaxBytes();
    if (fileStat.size > maxBytes) {
      warnings.push(`Over size cap (${(fileStat.size / (1024 * 1024)).toFixed(1)} MB)`);
      return { warnings };
    }
  } catch (error) {
    warnings.push('Missing output file');
    return { warnings };
  }

  try {
    const raw = await readFile(filePath, 'utf8');
    return { content: raw, warnings };
  } catch (error) {
    warnings.push('Failed to read file');
    return { warnings };
  }
}

async function parseHtml(filePath: string): Promise<ParserResult> {
  const { content, warnings } = await readTextFileWithCaps(filePath);
  if (!content) {
    return { warnings };
  }

  const sanitized = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const titleMatch = sanitized.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = sanitized.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const authorMeta = sanitized.match(/<meta[^>]+name=['"]?author['"]?[^>]*content=['"]([^'"]+)/i);

  const stripped = decodeHtmlEntities(sanitized.replace(/<[^>]+>/g, ' '));
  const normalized = normalizeWhitespace(stripped);

  return {
    text: normalized,
    title: decodeHtmlEntities(h1Match?.[1] ?? titleMatch?.[1] ?? '').trim() || undefined,
    author: authorMeta?.[1]?.trim(),
    detectedCourseId: detectCourseId(normalized),
    detectedAssignmentId: detectAssignmentId(normalized),
    pageCount: 1,
    warnings
  };
}

function findEocdOffset(buffer: Buffer): number {
  const signature = 0x06054b50;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) {
      return offset;
    }
  }
  return -1;
}

function listCentralDirectoryEntries(buffer: Buffer): Array<{
  name: string;
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}> {
  const entries: Array<{
    name: string;
    compressedSize: number;
    compressionMethod: number;
    localHeaderOffset: number;
  }> = [];
  const eocdOffset = findEocdOffset(buffer);
  if (eocdOffset === -1) {
    return entries;
  }
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const centralSignature = 0x02014b50;

  for (let index = 0; index < totalEntries && offset + 46 <= buffer.length; index += 1) {
    if (buffer.readUInt32LE(offset) !== centralSignature) {
      break;
    }
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > buffer.length) {
      break;
    }
    const name = buffer.toString('utf8', fileNameStart, fileNameEnd);
    entries.push({ name, compressedSize, compressionMethod, localHeaderOffset });
    offset = fileNameEnd + extraLength + commentLength;
  }

  return entries;
}

function extractZipEntry(buffer: Buffer, entryName: string): Buffer | undefined {
  const entries = listCentralDirectoryEntries(buffer);
  const target = entries.find((entry) => entry.name === entryName);
  if (!target) {
    return undefined;
  }
  const localSignature = 0x04034b50;
  const headerOffset = target.localHeaderOffset;
  if (headerOffset + 30 > buffer.length) {
    return undefined;
  }
  if (buffer.readUInt32LE(headerOffset) !== localSignature) {
    return undefined;
  }
  const fileNameLength = buffer.readUInt16LE(headerOffset + 26);
  const extraLength = buffer.readUInt16LE(headerOffset + 28);
  const dataStart = headerOffset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + target.compressedSize;
  if (dataEnd > buffer.length) {
    return undefined;
  }
  const compressed = buffer.subarray(dataStart, dataEnd);
  if (target.compressionMethod === 0) {
    return Buffer.from(compressed);
  }
  if (target.compressionMethod === 8) {
    try {
      return inflateRawSync(compressed);
    } catch (error) {
      return undefined;
    }
  }
  return undefined;
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractDocxText(xml: string): string {
  const textNodes = [] as string[];
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    textNodes.push(decodeXmlEntities(match[1] ?? ''));
  }
  const joined = textNodes.join(' ');
  return normalizeWhitespace(joined);
}

async function parseDocx(filePath: string): Promise<ParserResult> {
  const warnings: string[] = [];
  let buffer: Buffer;
  try {
    const fileStat = await stat(filePath);
    const maxBytes = getInsightsMaxBytes();
    if (fileStat.size > maxBytes) {
      warnings.push(`Over size cap (${(fileStat.size / (1024 * 1024)).toFixed(1)} MB)`);
      return { warnings };
    }
    buffer = await readFile(filePath);
  } catch (error) {
    warnings.push('Failed to read file');
    return { warnings };
  }

  const documentEntry = extractZipEntry(buffer, 'word/document.xml');
  if (!documentEntry) {
    warnings.push('Missing document.xml in DOCX');
    return { warnings };
  }

  const documentXml = documentEntry.toString('utf8');
  const text = extractDocxText(documentXml);
  const courseId = detectCourseId(text);
  const assignmentId = detectAssignmentId(text);

  let title: string | undefined;
  const titleRegex = /<w:p[^>]*>[^<]*<w:pStyle[^>]*w:val="Title"[^>]*>[\s\S]*?<w:t[^>]*>([\s\S]*?)<\/w:t>/i;
  const titleMatch = titleRegex.exec(documentXml);
  if (titleMatch?.[1]) {
    title = normalizeWhitespace(decodeXmlEntities(titleMatch[1]));
  } else {
    title = text.split(/\n|\. /)[0]?.trim() || undefined;
  }

  let author: string | undefined;
  const coreEntry = extractZipEntry(buffer, 'docProps/core.xml');
  if (coreEntry) {
    const coreXml = coreEntry.toString('utf8');
    const creatorMatch = coreXml.match(/<dc:creator>([\s\S]*?)<\/dc:creator>/i);
    if (creatorMatch?.[1]) {
      author = normalizeWhitespace(decodeXmlEntities(creatorMatch[1]));
    }
    if (!title) {
      const dcTitleMatch = coreXml.match(/<dc:title>([\s\S]*?)<\/dc:title>/i);
      if (dcTitleMatch?.[1]) {
        title = normalizeWhitespace(decodeXmlEntities(dcTitleMatch[1]));
      }
    }
  }

  let pageCount: number | undefined;
  const appEntry = extractZipEntry(buffer, 'docProps/app.xml');
  if (appEntry) {
    const appXml = appEntry.toString('utf8');
    const pagesMatch = appXml.match(/<Pages>(\d+)<\/Pages>/i);
    if (pagesMatch?.[1]) {
      pageCount = Number.parseInt(pagesMatch[1], 10);
      const maxPages = getInsightsMaxPages();
      if (pageCount > maxPages) {
        warnings.push(`Exceeded page cap (${pageCount} > ${maxPages})`);
      }
    }
  }

  return {
    text,
    title: title?.trim() || undefined,
    author,
    detectedCourseId: courseId,
    detectedAssignmentId: assignmentId,
    pageCount,
    warnings
  };
}

function decodePdfString(input: string): string {
  let output = input.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\b/g, '\b');
  output = output.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\');
  return output;
}

function extractPdfText(content: string): string {
  const textFragments: string[] = [];
  const textBlockRegex = /BT([\s\S]*?)ET/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = textBlockRegex.exec(content)) !== null) {
    const block = blockMatch[1] ?? '';
    const stringRegex = /\(([^()]|\\\(|\\\))*\)/g;
    let stringMatch: RegExpExecArray | null;
    while ((stringMatch = stringRegex.exec(block)) !== null) {
      const raw = stringMatch[0]?.slice(1, -1) ?? '';
      textFragments.push(decodePdfString(raw));
    }
  }
  if (textFragments.length === 0) {
    return '';
  }
  return normalizeWhitespace(textFragments.join(' '));
}

async function parsePdf(filePath: string): Promise<ParserResult> {
  const warnings: string[] = [];
  let buffer: Buffer;
  try {
    const fileStat = await stat(filePath);
    const maxBytes = getInsightsMaxBytes();
    if (fileStat.size > maxBytes) {
      warnings.push(`Over size cap (${(fileStat.size / (1024 * 1024)).toFixed(1)} MB)`);
      return { warnings };
    }
    buffer = await readFile(filePath);
  } catch (error) {
    warnings.push('Failed to read file');
    return { warnings };
  }

  const content = buffer.toString('latin1');
  let pageCount: number | undefined;
  const countMatch = content.match(/\/Count\s+(\d+)/);
  if (countMatch?.[1]) {
    pageCount = Number.parseInt(countMatch[1], 10);
  } else {
    const pageMatches = content.match(/\/Type\s*\/Page\b/g);
    if (pageMatches) {
      pageCount = pageMatches.length;
    }
  }
  if (typeof pageCount === 'number') {
    const maxPages = getInsightsMaxPages();
    if (pageCount > maxPages) {
      warnings.push(`Exceeded page cap (${pageCount} > ${maxPages})`);
    }
  }

  let text = '';
  try {
    text = extractPdfText(content);
  } catch (error) {
    warnings.push('Could not parse text');
  }

  if (!text) {
    warnings.push('No text extracted');
  }

  return {
    text,
    title: undefined,
    author: undefined,
    detectedCourseId: detectCourseId(text),
    detectedAssignmentId: detectAssignmentId(text),
    pageCount,
    warnings
  };
}

export async function parseArtifact(filePath: string, kind: ArtifactKind): Promise<ParserResult> {
  const normalizedPath = path.resolve(filePath);
  switch (kind) {
    case 'html':
      return parseHtml(normalizedPath);
    case 'docx':
      return parseDocx(normalizedPath);
    case 'pdf':
      return parsePdf(normalizedPath);
    default:
      return { warnings: ['Unsupported artifact type'] };
  }
}

export function countWords(text: string | undefined): number | undefined {
  if (!text) {
    return undefined;
  }
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 ? tokens.length : undefined;
}

export function computeKeywords(text: string | undefined, limit = 8): string[] | undefined {
  if (!text) {
    return undefined;
  }
  const frequency = new Map<string, number>();
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  for (const token of cleaned) {
    frequency.set(token, (frequency.get(token) ?? 0) + 1);
  }
  const sorted = [...frequency.entries()].sort((a, b) => {
    if (b[1] === a[1]) {
      return a[0].localeCompare(b[0]);
    }
    return b[1] - a[1];
  });
  return sorted.slice(0, limit).map(([token]) => token);
}
