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
      deliverables: {
        start(payload: {
          assignmentId: string;
          canvasFileId: string;
          prompt: string;
        }): Promise<IpcResult<{ jobId: string }>>;
        runDemo(payload: {
          assignmentId: string;
          canvasFileId: string;
          prompt: string;
        }): Promise<
          IpcResult<{
            jobId: string;
            artifacts: Array<{
              artifactId: string;
              status: string;
              signedUrl: string | null;
              errorCode: string | null;
              errorMessage: string | null;
            }>;
          }>
        >;
        listArtifacts(payload: { assignmentId: string }): Promise<
          IpcResult<
            Array<{
              artifactId: string;
              assignmentId: string;
              type: 'docx' | 'pdf';
              status: 'pending' | 'valid' | 'failed';
              sha256: string;
              mime: string;
              bytes: number;
              pageCount: number | null;
              paragraphCount: number | null;
              errorCode: string | null;
              errorMessage: string | null;
              createdAt: string;
              validatedAt: string | null;
              signedUrl: string | null;
              storageKey: string;
            }>
          >
        >;
        downloadSigned(payload: {
          artifactId: string;
          assignmentId?: string;
          source?: 'production' | 'demo';
        }): Promise<IpcResult<{ buffer: Buffer }>>;
        telemetryBlocked(payload: { reason: string }): Promise<IpcResult<null>>;
        regenerateDemo(payload: {
          assignmentId: string;
          canvasFileId: string;
          prompt: string;
        }): Promise<
          IpcResult<{
            jobId: string;
            artifacts: Array<{ artifactId: string; status: string; signedUrl: string | null }>;
          }>
        >;
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
