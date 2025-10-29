import type { AIRetrievalHit, AIStartRequest } from '../../src/shared/types/ai';

export type EmbedSource = {
  id: string;
  name: string;
  mime?: string;
  path: string;
};

export async function embedAndUpsert(_sources: EmbedSource[]): Promise<void> {
  // Placeholder implementation for development mode.
  // In production this would chunk the documents, embed them, and persist them to the vector store.
  return Promise.resolve();
}

export async function search(
  _payload: Pick<AIStartRequest, 'text' | 'courseId' | 'uploads' | 'youtubeUrl'>,
  topK = Number.parseInt(process.env.RAG_TOP_K ?? '6', 10)
): Promise<AIRetrievalHit[]> {
  if (!Number.isFinite(topK) || topK <= 0) {
    return [];
  }
  return [];
}
