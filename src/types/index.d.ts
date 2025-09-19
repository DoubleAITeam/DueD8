import type { IpcResult } from '../shared/ipc';

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
      tokens: {
        requestBudget(payload: {
          userId: string;
          assignmentId: number;
          courseId?: number;
          requestedTokens: number;
        }): Promise<IpcResult<import('../config/tokens').TokenBudgetResponse>>;
        logUsage(payload: {
          userId: string;
          assignmentId: number;
          courseId?: number;
          tokensUsed: number;
        }): Promise<IpcResult<null>>;
      };
      exports: {
        getGoogleDocument(assignmentId: number): Promise<
          IpcResult<{ documentId: string; documentUrl: string } | null>
        >;
        createGoogleDocument(payload: {
          assignmentId: number;
          courseId?: number;
          account: string;
          title: string;
          content: string;
        }): Promise<IpcResult<{ documentId: string; documentUrl: string }>>;
        generatePdf(payload: {
          assignmentId: number;
          courseCode: string;
          assignmentSlug: string;
          htmlBody: string;
        }): Promise<IpcResult<{ filePath: string }>>;
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
