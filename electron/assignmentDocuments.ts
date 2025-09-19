import { getDb } from './db';

export type AssignmentDocumentRecord = {
  assignment_id: number;
  course_id: number | null;
  google_document_id: string | null;
  created_at: string;
  updated_at: string;
};

export function getAssignmentDocument(assignmentId: number): AssignmentDocumentRecord | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT assignment_id, course_id, google_document_id, created_at, updated_at FROM assignment_documents WHERE assignment_id = ?`
    )
    .get(assignmentId) as AssignmentDocumentRecord | undefined;
  return row ?? null;
}

export function upsertAssignmentDocument(
  assignmentId: number,
  courseId: number | null,
  googleDocumentId: string
) {
  const db = getDb();
  db.prepare(`
      INSERT INTO assignment_documents (assignment_id, course_id, google_document_id)
      VALUES (?, ?, ?)
      ON CONFLICT(assignment_id) DO UPDATE SET
        course_id = excluded.course_id,
        google_document_id = excluded.google_document_id,
        updated_at = datetime('now')
    `).run(assignmentId, courseId ?? null, googleDocumentId);
}
