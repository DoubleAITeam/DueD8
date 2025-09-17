// state/store.ts
import { create } from 'zustand';

export type Profile = { name?: string; primary_email?: string };

type AppState = {
  connected: boolean;
  profile: Profile | null;
  toast: string | null;
  setConnected: (v: boolean) => void;
  setProfile: (p: Profile | null) => void;
  setToast: (message: string | null) => void;
};

export const useStore = create<AppState>((set) => ({
  connected: false,
  profile: null,
  toast: null,
  setConnected: (v) => set({ connected: v }),
  setProfile: (profile) => set({ profile }),
  setToast: (toast) => set({ toast })
}));