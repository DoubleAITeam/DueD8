import { getDb } from './db';

export type AssignmentExportRecord = {
  assignmentId: number;
  googleDocId: string | null;
  googleDocUrl: string | null;
  lastPdfPath: string | null;
  updatedAt: number | null;
};

function mapRow(row: any, assignmentId: number): AssignmentExportRecord {
  return {
    assignmentId,
    googleDocId: typeof row?.google_doc_id === 'string' ? row.google_doc_id : null,
    googleDocUrl: typeof row?.google_doc_url === 'string' ? row.google_doc_url : null,
    lastPdfPath: typeof row?.last_pdf_path === 'string' ? row.last_pdf_path : null,
    updatedAt: row?.updated_at ? Date.parse(row.updated_at) || null : null
  };
}

export function getAssignmentExportInfo(assignmentId: number): AssignmentExportRecord {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT google_doc_id, google_doc_url, last_pdf_path, updated_at FROM assignment_export WHERE assignment_id = ?`
    )
    .get(assignmentId);
  if (!row) {
    return mapRow({}, assignmentId);
  }
  return mapRow(row, assignmentId);
}

export function saveGoogleDocInfo(assignmentId: number, docId: string, docUrl: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO assignment_export (assignment_id, google_doc_id, google_doc_url, updated_at)
     VALUES (@assignmentId, @docId, @docUrl, datetime('now'))
     ON CONFLICT(assignment_id) DO UPDATE SET
       google_doc_id = excluded.google_doc_id,
       google_doc_url = excluded.google_doc_url,
       updated_at = datetime('now')`
  ).run({ assignmentId, docId, docUrl });
}

export function savePdfPath(assignmentId: number, pdfPath: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO assignment_export (assignment_id, last_pdf_path, updated_at)
     VALUES (@assignmentId, @pdfPath, datetime('now'))
     ON CONFLICT(assignment_id) DO UPDATE SET
       last_pdf_path = excluded.last_pdf_path,
       updated_at = datetime('now')`
  ).run({ assignmentId, pdfPath });
}
