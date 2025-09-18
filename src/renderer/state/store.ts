// state/store.ts
import { create } from 'zustand';

export type Profile = { name?: string; primary_email?: string };

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
};

type AppState = {
  connected: boolean;
  profile: Profile | null;
  toast: string | null;
  view: ViewState;
  assignmentContexts: Record<number, AssignmentContextEntry[]>;
  setConnected: (v: boolean) => void;
  setProfile: (p: Profile | null) => void;
  setToast: (message: string | null) => void;
  setView: (view: ViewState) => void;
  appendAssignmentContext: (assignmentId: number, entries: AssignmentContextEntry[]) => void;
};

export const useStore = create<AppState>((set) => ({
  connected: false,
  profile: { name: 'Loading...', primary_email: '' },
  toast: null,
  view: { screen: 'dashboard' },
  assignmentContexts: {},
  setConnected: (v) => set({ connected: v }),
  setProfile: (profile) => set({ profile }),
  setToast: (toast) => set({ toast }),
  setView: (view) => set({ view }),
  // PHASE 2: Merge new upload results with any existing context for the assignment.
  appendAssignmentContext: (assignmentId, entries) =>
    set((state) => ({
      assignmentContexts: {
        ...state.assignmentContexts,
        [assignmentId]: [...(state.assignmentContexts[assignmentId] ?? []), ...entries]
      }
    }))
}));