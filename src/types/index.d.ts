import type { IpcResult } from '../shared/ipc';
import type {
  Card,
  Deck,
  FlashcardQuotaInfo,
  SaveSourceAssetInput,
  SearchCardsResult,
  SourceAsset
} from '../shared/flashcards';
import type {
  ArtifactInput,
  ArtifactKind,
  DeliverableLogEntry,
  DeliverableRunRecord
} from '../../electron/deliverables/types';
import type { CourseContext, Rule } from '../../electron/deliverables/postprocess/types';
import type { AdapterOverviewEntry } from '../../electron/deliverables/renderers/registry';
import type { ZipResult } from '../../electron/deliverables/archive';
import type { RetentionConfig, RetentionSweepResult } from '../../electron/deliverables/retention';
import type { InsightBundle } from '../../electron/deliverables/insights/types';
import type { AiResetState } from '../../electron/deliverables/reset/state';
import type { BudgetState } from '../../electron/tokenBudget';
import type { AIStartRequest, AIStreamEvent } from '../shared/types/ai';

export {};

declare global {
  interface Window {
    electron: {
      invoke(
        channel: 'runDeliverablesPipeline',
        artifacts: ArtifactInput[],
        options?: { concurrency?: number; dryRun?: boolean; post?: { enable?: boolean; dryRun?: boolean; ctx?: CourseContext } }
      ): Promise<{ success: boolean; run: DeliverableRunRecord }>;
      invoke(
        channel: 'deliverables:runWithPost',
        artifacts: ArtifactInput[],
        options?: { concurrency?: number; dryRun?: boolean; post?: { enable?: boolean; dryRun?: boolean; ctx?: CourseContext } }
      ): Promise<{ success: boolean; run: DeliverableRunRecord }>;
      invoke(channel: 'deliverables:getRuns', limit?: number): Promise<DeliverableRunRecord[]>;
      invoke(channel: 'deliverables:resetRuns'): Promise<boolean>;
      invoke(
        channel: 'deliverables:getAdapterHealth'
      ): Promise<Record<ArtifactKind, AdapterOverviewEntry>>;
      invoke(channel: 'deliverables:getLogs'): Promise<DeliverableLogEntry[]>;
      invoke(channel: 'deliverables:getRules'): Promise<Rule[]>;
      invoke(channel: 'deliverables:setRules', rules: Rule[]): Promise<{ ok: boolean; message?: string }>;
      invoke(channel: 'deliverables:resetRules'): Promise<Rule[]>;
      invoke(
        channel: 'deliverables:buildBaseInsights',
        runId: string,
        options?: { limit?: number }
      ): Promise<InsightBundle | null>;
      invoke(channel: 'deliverables:buildAiInsights', runId: string): Promise<InsightBundle | null>;
      invoke(channel: 'deliverables:getInsights', runId: string): Promise<InsightBundle | null>;
      invoke(
        channel: 'deliverables:saveInsightCorrection',
        runId: string,
        artifactId: string,
        patch: { title?: string; detectedCourseId?: string; detectedAssignmentId?: string }
      ): Promise<InsightBundle | null>;
      invoke(channel: 'deliverables:isAiInsightsEnabled'): Promise<boolean>;
      invoke(
        channel: 'deliverables:getInsightRedactionInfo'
      ): Promise<{ enabled: boolean; patterns: string[] }>;
      invoke(channel: 'deliverables:getAiResetState'): Promise<AiResetState>;
      invoke(channel: 'deliverables:revealInFolder', targetPath: string): Promise<boolean>;
      invoke(channel: 'deliverables:openPath', targetPath: string): Promise<{ ok: boolean; message?: string }>;
      invoke(channel: 'deliverables:moveToTrash', targetPath: string): Promise<{ ok: boolean; message?: string }>;
      invoke(channel: 'deliverables:zipRun', runId: string): Promise<ZipResult>;
      invoke(channel: 'deliverables:zipArtifacts', runId: string, artifactIds: string[]): Promise<ZipResult>;
      invoke(channel: 'deliverables:sweepOldOutputs', config?: RetentionConfig): Promise<RetentionSweepResult>;
      invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
    };
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
      deliverables: {
        revealInFolder(targetPath: string): Promise<boolean>;
        openPath(targetPath: string): Promise<{ ok: boolean; message?: string }>;
        moveToTrash(targetPath: string): Promise<{ ok: boolean; message?: string }>;
        zipRun(runId: string): Promise<ZipResult>;
        zipArtifacts(runId: string, artifactIds: string[]): Promise<ZipResult>;
        sweepOldOutputs(config?: RetentionConfig): Promise<RetentionSweepResult>;
        buildBaseInsights(runId: string, options?: { limit?: number }): Promise<InsightBundle | null>;
        buildAiInsights(runId: string): Promise<InsightBundle | null>;
        getInsights(runId: string): Promise<InsightBundle | null>;
        saveInsightCorrection(
          runId: string,
          artifactId: string,
          patch: { title?: string; detectedCourseId?: string; detectedAssignmentId?: string }
        ): Promise<InsightBundle | null>;
        isAiInsightsEnabled(): Promise<boolean>;
        getInsightRedactionInfo(): Promise<{ enabled: boolean; patterns: string[] }>;
      };
      aiReset: {
        getState(): Promise<AiResetState>;
      };
      budget: {
        getState(): Promise<BudgetState>;
        setPlan(plan: string): Promise<BudgetState>;
        setCap(cap: number): Promise<BudgetState>;
        reset(): Promise<BudgetState>;
        refreshPlan(): Promise<BudgetState>;
        checkAndReserve(cost: number): Promise<{ ok: boolean; used: number; limit: number }>;
        release(cost: number): Promise<BudgetState>;
        consume(amount: number): Promise<BudgetState>;
        getProFeatures(): Promise<string[]>;
        onChanged(listener: (state: BudgetState) => void): () => void;
        onBlocked(listener: (state: BudgetState) => void): () => void;
      };
      ai: {
        chat: {
          start(payload: AIStartRequest): void;
          onEvent(messageId: string, listener: (event: AIStreamEvent) => void): () => void;
        };
        paywall: {
          onOpen(listener: () => void): () => void;
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
