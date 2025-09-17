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
        get(payload: { path: string; query?: Record<string, string | number | boolean> }): Promise<IpcResult<unknown>>;
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
    };
  }
}
