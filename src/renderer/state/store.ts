// state/store.ts
import { create } from 'zustand';
import type { Assignment, Course } from '../../lib/canvasClient';

export type Profile = { name?: string; primary_email?: string };

export type ViewState =
  | { name: 'dashboard' }
  | { name: 'course'; course: Course }
  | { name: 'assignment'; course: Course; assignment: Assignment };

type AppState = {
  connected: boolean;
  profile: Profile | null;
  toast: string | null;
  view: ViewState;
  setConnected: (v: boolean) => void;
  setProfile: (p: Profile | null) => void;
  setToast: (message: string | null) => void;
  navigateToDashboard: () => void;
  navigateToCourse: (course: Course) => void;
  navigateToAssignment: (course: Course, assignment: Assignment) => void;
};

export const useStore = create<AppState>((set) => ({
  connected: false,
  profile: null,
  toast: null,
  view: { name: 'dashboard' },
  setConnected: (v) => set({ connected: v }),
  setProfile: (profile) => set({ profile }),
  setToast: (toast) => set({ toast }),
  navigateToDashboard: () => set({ view: { name: 'dashboard' } }),
  navigateToCourse: (course) => set({ view: { name: 'course', course } }),
  navigateToAssignment: (course, assignment) => set({ view: { name: 'assignment', course, assignment } })
}));