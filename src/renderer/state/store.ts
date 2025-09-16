// state/store.ts
import { create } from "zustand";
type State = { connected: boolean; setConnected: (v: boolean) => void };
export const useStore = create<State>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v })
}));