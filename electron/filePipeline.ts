import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { AssignmentDetail, ProcessedFile } from '../src/shared/types';
import { mainError, mainLog } from './logger';

const ProcessFileSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1)
});

export const ProcessPayloadSchema = z.object({
  assignmentId: z.number().int().positive(),
  courseId: z.number().int().positive(),
  files: z.array(ProcessFileSchema).min(1)
});

export type ProcessPayload = z.infer<typeof ProcessPayloadSchema>;

type StoreShape = AssignmentDetail[];

function storePath() {
  return path.join(app.getPath('userData'), 'assignment-store.json');
}

async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      mainError('Failed reading assignment store', (error as Error).message);
    }
    return [];
  }
}

async function writeStore(records: StoreShape) {
  await fs.mkdir(path.dirname(storePath()), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(records, null, 2), 'utf8');
}

function summarizeText(chunks: string[]): string {
  const joined = chunks.filter(Boolean).join('\n\n');
  if (!joined) {
    return 'No text extracted from the provided files.';
  }
  // Limit stored text to avoid unbounded JSON growth
  return joined.length > 20000 ? `${joined.slice(0, 20000)}…` : joined;
}

async function extractFileText(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    const text = buffer.toString('utf8');
    return text.trim();
  } catch (error) {
    mainError('Failed reading file for extraction', filePath, (error as Error).message);
    return '';
  }
}

export async function processAssignmentFiles(payload: ProcessPayload): Promise<AssignmentDetail> {
  const now = new Date().toISOString();
  const processedFiles: ProcessedFile[] = [];
  const textChunks: string[] = [];

  for (const file of payload.files) {
    try {
      const stats = await fs.stat(file.path);
      const extracted = await extractFileText(file.path);
      textChunks.push(extracted);
      processedFiles.push({
        name: file.name,
        path: file.path,
        size: stats.size,
        processedAt: now,
        extractedText: extracted.length > 2000 ? `${extracted.slice(0, 2000)}…` : extracted
      });
    } catch (error) {
      mainError('File processing failed', file.path, (error as Error).message);
      processedFiles.push({
        name: file.name,
        path: file.path,
        size: 0,
        processedAt: now,
        extractedText: `Error processing file: ${(error as Error).message}`
      });
    }
  }

  const record: AssignmentDetail = {
    assignmentId: payload.assignmentId,
    courseId: payload.courseId,
    files: processedFiles,
    extractedText: summarizeText(textChunks),
    updatedAt: now
  };

  const store = await readStore();
  const existingIndex = store.findIndex((entry) => entry.assignmentId === payload.assignmentId);
  if (existingIndex >= 0) {
    store[existingIndex] = record;
  } else {
    store.push(record);
  }
  await writeStore(store);
  mainLog('Stored assignment processing result', payload.assignmentId, processedFiles.length);

  return record;
}

export async function getAssignmentDetails(assignmentId: number): Promise<AssignmentDetail | null> {
  const store = await readStore();
  return store.find((entry) => entry.assignmentId === assignmentId) ?? null;
}
