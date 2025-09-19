import { ensureGoogleAccessToken } from './googleAuth';
import { getAssignmentDocument, upsertAssignmentDocument } from './assignmentDocuments';

function normalisePlainText(input: string): string {
  const trimmed = input.replace(/\r\n/g, '\n').trim();
  if (!trimmed.length) {
    return ' '; // Google Docs rejects completely empty insert requests
  }
  return `${trimmed}\n`;
}

async function createDocument(accessToken: string, title: string): Promise<string> {
  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title })
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to create Google Doc (${response.status}): ${message}`);
  }
  const data = (await response.json()) as { documentId?: string };
  if (!data.documentId) {
    throw new Error('Google Docs did not return a documentId');
  }
  return data.documentId;
}

async function fetchDocumentEndIndex(accessToken: string, documentId: string): Promise<number> {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to load Google Doc metadata (${response.status}): ${message}`);
  }
  const data = (await response.json()) as { body?: { content?: Array<{ endIndex?: number }> } };
  const content = data.body?.content ?? [];
  const last = content[content.length - 1];
  const endIndex = typeof last?.endIndex === 'number' ? last.endIndex : 1;
  return Math.max(endIndex, 1);
}

async function overwriteDocumentContent(
  accessToken: string,
  documentId: string,
  plainText: string
) {
  const endIndex = await fetchDocumentEndIndex(accessToken, documentId);
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        { deleteContentRange: { range: { startIndex: 1, endIndex } } },
        { insertText: { location: { index: 1 }, text: normalisePlainText(plainText) } }
      ]
    })
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to update Google Doc content (${response.status}): ${message}`);
  }
}

export async function createOrUpdateGoogleDoc(options: {
  assignmentId: number;
  courseId?: number | null;
  title: string;
  plainText: string;
}): Promise<{ documentId: string; url: string; status: 'created' | 'updated' }> {
  const { assignmentId, courseId, title, plainText } = options;
  const { accessToken } = await ensureGoogleAccessToken();
  const existing = getAssignmentDocument(assignmentId);

  if (existing?.google_document_id) {
    await overwriteDocumentContent(accessToken, existing.google_document_id, plainText);
    return {
      documentId: existing.google_document_id,
      url: `https://docs.google.com/document/d/${existing.google_document_id}/edit`,
      status: 'updated'
    };
  }

  const documentId = await createDocument(accessToken, title);
  await overwriteDocumentContent(accessToken, documentId, plainText);
  upsertAssignmentDocument(assignmentId, courseId ?? null, documentId);
  return {
    documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    status: 'created'
  };
}

export function getStoredGoogleDocLink(assignmentId: number): string | null {
  const existing = getAssignmentDocument(assignmentId);
  if (existing?.google_document_id) {
    return `https://docs.google.com/document/d/${existing.google_document_id}/edit`;
  }
  return null;
}
