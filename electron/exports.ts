import { app, dialog, shell } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getDb } from './db';
import { normaliseEmail } from './tokenUsage';

function safeCourseCode(input?: string | null) {
  if (!input) return 'COURSE';
  const alnum = input.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase();
  return alnum.length ? alnum : 'COURSE';
}

function slugify(input?: string | null) {
  if (!input) return 'assignment';
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length ? slug : 'assignment';
}

function formatDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

function generatePdfStream(content: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const operations: string[] = [];
  operations.push('BT');
  operations.push('/F1 12 Tf');
  operations.push('72 720 Td');
  lines.forEach((line, index) => {
    const escaped = line
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    operations.push(`(${escaped.length ? escaped : ' '}) Tj`);
    if (index < lines.length - 1) {
      operations.push('0 -16 Td');
    }
  });
  operations.push('ET');
  return operations.join('\n');
}

function generatePdfBuffer(content: string) {
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
  return Buffer.from(pdfBytes);
}

export async function promptForPdfSave({
  content,
  assignmentName,
  courseName
}: {
  content: string;
  assignmentName?: string | null;
  courseName?: string | null;
}) {
  const courseCode = safeCourseCode(courseName);
  const assignmentSlug = slugify(assignmentName);
  const defaultName = `${courseCode}_${assignmentSlug}_${formatDateStamp()}.pdf`;
  const defaultPath = path.join(app.getPath('documents'), defaultName);

  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePath) {
    return { cancelled: true } as const;
  }

  const buffer = generatePdfBuffer(content);
  await fs.writeFile(result.filePath, buffer);
  return { cancelled: false, filePath: result.filePath } as const;
}

export function getGoogleConnection() {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT connected, connected_at as connectedAt, account_email as accountEmail FROM google_connection WHERE id = 1`
    )
    .get() as { connected: number; connectedAt?: string | null; accountEmail?: string | null } | undefined;
  if (!row) {
    return { connected: false, accountEmail: null } as const;
  }
  return { connected: Boolean(row.connected), accountEmail: row.accountEmail ?? null } as const;
}

export function markGoogleConnected(accountEmail?: string | null) {
  const db = getDb();
  db.prepare(
    `UPDATE google_connection SET connected = 1, connected_at = datetime('now'), account_email = ? WHERE id = 1`
  ).run(accountEmail ?? null);
}

export function markGoogleDisconnected() {
  const db = getDb();
  db.prepare(`UPDATE google_connection SET connected = 0 WHERE id = 1`).run();
}

export function getAssignmentGoogleDoc(assignmentId: number) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT document_id as documentId, document_url as documentUrl FROM assignment_google_doc WHERE assignment_id = ?`
    )
    .get(assignmentId) as { documentId: string; documentUrl: string } | undefined;
  return row ?? null;
}

export function saveAssignmentGoogleDoc(assignmentId: number, documentId: string, documentUrl: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO assignment_google_doc (assignment_id, document_id, document_url)
     VALUES (?, ?, ?)
     ON CONFLICT(assignment_id) DO UPDATE SET document_id=excluded.document_id, document_url=excluded.document_url`
  ).run(assignmentId, documentId, documentUrl);
}

export async function createGoogleDoc({
  assignmentId,
  title: _title,
  content: _content,
  accountEmail
}: {
  assignmentId: number;
  title: string;
  content: string;
  accountEmail?: string | null;
}) {
  const connection = getGoogleConnection();
  if (!connection.connected) {
    return { status: 'auth-required' as const };
  }

  const existing = getAssignmentGoogleDoc(assignmentId);
  if (existing) {
    return { status: 'ok' as const, documentId: existing.documentId, documentUrl: existing.documentUrl };
  }

  const documentId = crypto.randomUUID();
  const documentUrl = `https://docs.google.com/document/d/${documentId}`;

  saveAssignmentGoogleDoc(assignmentId, documentId, documentUrl);
  void shell.openExternal(documentUrl);

  return { status: 'ok' as const, documentId, documentUrl };
}

export function connectGoogleAccount(accountEmail?: string | null) {
  markGoogleConnected(normaliseEmail(accountEmail));
  return getGoogleConnection();
}
