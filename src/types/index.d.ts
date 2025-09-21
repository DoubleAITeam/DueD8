import type { IpcResult } from '../shared/ipc';
import type {
  Card,
  Deck,
  FlashcardQuotaInfo,
  SaveSourceAssetInput,
  SearchCardsResult,
  SourceAsset
} from '../shared/flashcards';

export {};

declare global {
  interface Window {
    dued8: {
      ping(): Promise<string>;
      canvas: {
        setToken(token: string): Promise<IpcResult<null>>;
        getToken(): Promise<IpcResult<string | null>>;
        clearToken(): Promise<IpcResult<null>>;
        testToken(): Promise<IpcResult<{ profile?: unknown }>>;
        get(
          payload: {
            path: string;
            query?: Record<string, string | number | boolean | Array<string | number | boolean>>;
          }
        ): Promise<IpcResult<unknown>>;
      };
      students: {
        add(s: { first_name: string; last_name: string; county: 'Fairfax' | 'Sci-Tech' }): Promise<{ id: number }>;
        list(): Promise<Array<{ id: number; first_name: string; last_name: string; county: string; created_at: string }>>;
      };
      events: {
        upsert(name: string, event_date: string): Promise<{ id: number; updated: boolean }>;
      };
      attendance: {
        set(student_id: number, event_id: number, status: 'Present' | 'Absent' | 'NO AMP'): Promise<boolean>;
      };
      files: {
        processUploads(
          files: Array<{ path: string; name: string; type?: string }>
        ): Promise<IpcResult<Array<{ fileName: string; content: string }>>>;
      };
      assignments: {
        fetchInstructorContext(payload: {
          assignmentId: number;
          courseId: number;
        }): Promise<
          IpcResult<{
            entries: Array<{ fileName: string; content: string; uploadedAt: number }>;
            attachments: Array<{ id: string; name: string; url: string; contentType: string | null }>;
            htmlUrl: string | null;
          }>
        >;
      };
      flashcards: {
        listDecks(): Promise<IpcResult<Deck[]>>;
        getDeck(deckId: string): Promise<IpcResult<Deck>>;
        createDeck(payload: { title: string; scope: 'class' | 'general'; classId?: string; tags?: string[] }): Promise<IpcResult<Deck>>;
        updateDeck(payload: {
          deckId: string;
          title?: string;
          scope?: 'class' | 'general';
          classId?: string | null;
          tags?: string[];
          cardIds?: string[];
        }): Promise<IpcResult<Deck>>;
        deleteDeck(deckId: string): Promise<IpcResult<null>>;
        listCards(payload: { deckId: string; sort?: 'recent' | 'alphabetical' | 'studied' }): Promise<IpcResult<Card[]>>;
        createCard(payload: { deckId: string; front: string; back: string; tags?: string[]; sourceIds?: string[] }): Promise<IpcResult<Card>>;
        updateCard(payload: {
          cardId: string;
          front?: string;
          back?: string;
          tags?: string[];
          sourceIds?: string[];
          studiedCount?: number;
          lastStudiedAt?: string | null;
        }): Promise<IpcResult<Card>>;
        deleteCard(cardId: string): Promise<IpcResult<null>>;
        moveCards(payload: { cardIds: string[]; targetDeckId: string; position?: number | 'start' | 'end' }): Promise<IpcResult<Deck>>;
        mergeDecks(payload: { sourceDeckId: string; targetDeckId: string }): Promise<IpcResult<Deck>>;
        search(query: string): Promise<IpcResult<SearchCardsResult[]>>;
        saveSource(payload: SaveSourceAssetInput): Promise<IpcResult<SourceAsset>>;
        getSource(id: string): Promise<IpcResult<SourceAsset>>;
        quota: {
          check(userId: string): Promise<IpcResult<FlashcardQuotaInfo>>;
          increment(userId: string, amount: number): Promise<IpcResult<FlashcardQuotaInfo>>;
        };
      };
    };
  }

  interface File {
    /**
     * PHASE 2: Electron augments File with an absolute path that the main process can read.
     */
    path?: string;
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.mjs?url' {
  const src: string;
  export default src;
}
