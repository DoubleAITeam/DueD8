

export {};

declare global {
  interface Window {
    dued8: {
      token: {
        save(token: string): Promise<boolean>;
        get(): Promise<string | null>;
        info(): Promise<{ length: number; startsWith: string } | null>;
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
      canvas: {
        testToken(): Promise<any>;
      };
    };
  }
}