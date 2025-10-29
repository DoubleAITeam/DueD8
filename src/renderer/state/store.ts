// state/store.ts
import { create } from 'zustand';

export type Profile = {
  name?: string;
  primary_email?: string;
  plan?: 'free' | 'premium';
  isPremium?: boolean;
  avatarUrl?: string | null;
};

// PHASE 2: Track the active screen so uploads can open a dedicated assignment view.
export type ViewState =
  | { screen: 'dashboard' }
  | { screen: 'course'; courseId: number }
  | { screen: 'assignment'; courseId: number; assignmentId: number };

// PHASE 2: Persist parsed file content so the chatbot can reuse it later.
export type AssignmentContextEntry = {
  fileName: string;
  content: string;
  uploadedAt: number;
  source?: 'user' | 'instructor';
};

type AppState = {
  connected: boolean;
  profile: Profile | null;
  toast: string | null;
  view: ViewState;
  assignmentContexts: Record<number, AssignmentContextEntry[]>;
  chatbotMinimized: boolean;
  setConnected: (v: boolean) => void;
  setProfile: (p: Profile | null) => void;
  setToast: (message: string | null) => void;
  setView: (view: ViewState) => void;
  appendAssignmentContext: (assignmentId: number, entries: AssignmentContextEntry[]) => void;
  setChatbotMinimized: (value: boolean) => void;
};

export const useStore = create<AppState>((set) => ({
  connected: false,
  profile: null,
  toast: null,
  view: { screen: 'dashboard' },
  assignmentContexts: {},
  chatbotMinimized: false,
  setConnected: (v) => set({ connected: v }),
  setProfile: (profile) => set({ profile }),
  setToast: (toast) => set({ toast }),
  setView: (view) => set({ view }),
  // PHASE 2: Merge new upload results with any existing context for the assignment.
  appendAssignmentContext: (assignmentId, entries) =>
    set((state) => ({
      assignmentContexts: {
        ...state.assignmentContexts,
        [assignmentId]: (() => {
          const existing = state.assignmentContexts[assignmentId] ?? [];
          const seen = new Set(
            existing.map((entry) =>
              `${entry.source ?? 'user'}::${entry.fileName}::${entry.content}`
            )
          );
          const normalisedNew = entries.map((entry) => ({
            ...entry,
            source: entry.source ?? 'user'
          }));
          const merged = [...existing];
          for (const entry of normalisedNew) {
            const key = `${entry.source ?? 'user'}::${entry.fileName}::${entry.content}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(entry);
            }
          }
          return merged;
        })()
      }
    })),
  setChatbotMinimized: (value) => set({ chatbotMinimized: value })
}));
