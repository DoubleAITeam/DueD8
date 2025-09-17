import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type UploadDescriptor = { path: string; name: string; type?: string };
export type ProcessedFile = { fileName: string; content: string };

// PHASE 2: Decode the simple escape sequences Canvas attachments often contain.
function decodePdfEscapes(input: string) {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_match, octal) => {
      const code = parseInt(octal, 8);
      return Number.isNaN(code) ? '' : String.fromCharCode(code);
    });
}

// PHASE 2: Naively pull printable segments out of PDF streams without third-party libraries.
async function parsePdf(filePath: string) {
  const buffer = await fs.readFile(filePath);
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
        captured += `${decodePdfEscapes(current)}\n`;
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

// PHASE 2: Use the system unzip utility to extract the DOCX XML payload.
async function parseDocx(filePath: string) {
  const { stdout } = await execFileAsync('unzip', ['-p', filePath, 'word/document.xml']);
  const xml = stdout.toString();
  return xml
    .replace(/<w:p[^>]*>/g, '\n')
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length)
    .join('\n');
}

async function parseTxt(filePath: string) {
  return fs.readFile(filePath, 'utf8');
}

// PHASE 2: Central helper that normalises different document types for the chatbot.
export async function processAssignmentUploads(files: UploadDescriptor[]): Promise<ProcessedFile[]> {
  const results: ProcessedFile[] = [];

  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!file.path) {
      throw new Error(`File path missing for ${file.name}`);
    }

    let content = '';
    if (ext === '.pdf') {
      content = await parsePdf(file.path);
    } else if (ext === '.docx') {
      content = await parseDocx(file.path);
    } else if (ext === '.txt') {
      content = await parseTxt(file.path);
    } else {
      throw new Error(`Unsupported file type: ${ext || file.type || 'unknown'}`);
    }

    // PHASE 2: Keep paragraph structure readable for downstream chatbot summarisation.
    const normalized = content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t+/g, ' ')
      .replace(/[ \u00a0]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    results.push({ fileName: file.name, content: normalized });
  }

  return results;
}
