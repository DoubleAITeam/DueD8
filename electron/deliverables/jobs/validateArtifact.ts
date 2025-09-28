import JSZip from 'jszip';
import { DeliverablesDataStore } from '../dataStore';
import { LocalObjectStorageAdapter, detectMimeByMagic } from '../storageAdapter';
import { ArtifactRecord } from '../types';
import { mainLog } from '../../logger';

const DOCX_MIN_BYTES = 10 * 1024;
const DOCX_MIN_WORDS = 300;
const DOCX_MIN_PARAGRAPHS = 6;
const PDF_MIN_BYTES = 8 * 1024;

async function inspectDocx(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const document = zip.file('word/document.xml');
  if (!document) {
    throw new Error('Missing document.xml in DOCX');
  }
  const xml = await document.async('string');
  const paragraphCount = (xml.match(/<w:p[\s>]/g) || []).length;
  const headingCount = (xml.match(/<w:pStyle w:val="Heading[1-6]"/g) || []).length;
  const hasTitle = /<w:pStyle w:val="Title"/.test(xml);
  const stripped = xml
    .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const wordCount = stripped
    .split(/[\s\u200b]+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
  return { paragraphCount, headingCount, hasTitle, wordCount };
}

function extractPdfText(buffer: Buffer) {
  const data = buffer.toString('latin1');
  let depth = 0;
  let current = '';
  let captured = '';

  for (let i = 0; i < data.length; i += 1) {
    const char = data[i];
    if (char === '(') {
      if (depth === 0) {
        current = '';
      } else {
        current += char;
      }
      depth += 1;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        captured += `${current}\n`;
        current = '';
      } else if (depth > 0) {
        current += char;
      }
      continue;
    }

    if (char === '\\' && depth > 0) {
      current += char;
      i += 1;
      if (i < data.length) {
        current += data[i];
      }
      continue;
    }

    if (depth > 0) {
      current += char;
    }
  }

  return captured
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length)
    .join('\n');
}

function inspectPdf(buffer: Buffer) {
  const text = extractPdfText(buffer);
  const raw = buffer.toString('latin1');
  const pageCount = (raw.match(/\/Type\s*\/Page/g) || []).length;
  return { pageCount, textLength: text.length };
}

export class ArtifactValidator {
  private store: DeliverablesDataStore;
  private storage: LocalObjectStorageAdapter;

  constructor(store: DeliverablesDataStore, storage: LocalObjectStorageAdapter) {
    this.store = store;
    this.storage = storage;
  }

  async execute(artifact: ArtifactRecord): Promise<ArtifactRecord> {
    const buffer = await this.storage.getObject(artifact.storageKey);
    const mime = detectMimeByMagic(buffer);
    if (!mime) {
      return this.fail(artifact, 'MIME_MISMATCH', 'Unable to detect MIME');
    }
    if (mime !== artifact.mime) {
      return this.fail(artifact, 'MIME_MISMATCH', `Expected ${artifact.mime} but detected ${mime}`);
    }

    if (artifact.type === 'docx' && buffer.length < DOCX_MIN_BYTES) {
      return this.fail(artifact, 'DOCX_TOO_SMALL', 'DOCX below minimum size threshold');
    }
    if (artifact.type === 'pdf' && buffer.length < PDF_MIN_BYTES) {
      return this.fail(artifact, 'PDF_TOO_SMALL', 'PDF below minimum size threshold');
    }

    if (artifact.type === 'docx') {
      const { paragraphCount, headingCount, hasTitle, wordCount } = await inspectDocx(buffer);
      if (!hasTitle) {
        return this.fail(artifact, 'DOCX_MISSING_TITLE', 'DOCX missing title paragraph');
      }
      if (headingCount < 2) {
        return this.fail(artifact, 'DOCX_HEADING_SHORT', 'DOCX requires at least two headings');
      }
      if (paragraphCount < DOCX_MIN_PARAGRAPHS) {
        return this.fail(
          artifact,
          'LOW_CONTENT',
          `DOCX requires at least ${DOCX_MIN_PARAGRAPHS} paragraphs (${paragraphCount} present)`
        );
      }
      if (wordCount < DOCX_MIN_WORDS) {
        return this.fail(
          artifact,
          'LOW_CONTENT',
          `DOCX requires at least ${DOCX_MIN_WORDS} words (${wordCount} present)`
        );
      }
      const signedUrl = this.storage.createSignedUrl(artifact.storageKey);
      return this.store.updateArtifact(artifact.artifactId, {
        status: 'valid',
        validatedAt: new Date().toISOString(),
        paragraphCount,
        signedUrl
      }) as Promise<ArtifactRecord>;
    }

    const { pageCount, textLength: measuredLength } = await inspectPdf(buffer);
    const storedLength = artifact.paragraphCount ?? null;
    const textLength = storedLength && storedLength > measuredLength ? storedLength : measuredLength;
    if (pageCount < 1) {
      return this.fail(artifact, 'PDF_PAGE_SHORT', 'PDF must contain at least one page');
    }
    if (textLength < 200) {
      return this.fail(
        artifact,
        'PDF_TEXT_SHORT',
        `PDF text content too short (${textLength} chars)`
      );
    }

    const signedUrl = this.storage.createSignedUrl(artifact.storageKey);
    return (await this.store.updateArtifact(artifact.artifactId, {
      status: 'valid',
      validatedAt: new Date().toISOString(),
      pageCount,
      paragraphCount: textLength,
      signedUrl
    })) as ArtifactRecord;
  }

  private async fail(artifact: ArtifactRecord, code: string, message: string) {
    mainLog('[deliverables][validation]', {
      artifactId: artifact.artifactId,
      code,
      message
    });
    return (await this.store.updateArtifact(artifact.artifactId, {
      status: 'failed',
      errorCode: code,
      errorMessage: message,
      validatedAt: new Date().toISOString()
    })) as ArtifactRecord;
  }
}
