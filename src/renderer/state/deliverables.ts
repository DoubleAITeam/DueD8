import { create } from 'zustand';

type DeliverablesState = {
  status: 'idle' | 'running' | 'success' | 'error';
  message: string | null;
  setRunning: () => void;
  setResult: (result: { success: boolean; message: string }) => void;
  reset: () => void;
};

export const useDeliverablesStore = create<DeliverablesState>((set) => ({
  status: 'idle',
  message: null,
  setRunning: () => set({ status: 'running', message: null }),
  setResult: (result) =>
    set({
      status: result.success ? 'success' : 'error',
      message: result.message
    }),
  reset: () => set({ status: 'idle', message: null })
}));
