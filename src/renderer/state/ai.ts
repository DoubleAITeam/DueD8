import { create } from 'zustand';
import type { AiResetState } from '../../../electron/deliverables/reset/state';

type AiRuntimeStore = {
  state: AiResetState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setStateSnapshot: (next: AiResetState) => void;
};

export const useAiRuntimeStore = create<AiRuntimeStore>((set) => ({
  state: null,
  loading: false,
  error: null,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const snapshot = await window.electron.invoke('deliverables:getAiResetState');
      set({ state: snapshot, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load AI runtime state.';
      set({ error: message, loading: false });
    }
  },
  setStateSnapshot: (next) => set({ state: next })
}));

export function useAiRuntimeState<T>(selector: (state: AiRuntimeStore) => T): T {
  return useAiRuntimeStore(selector);
}

export function selectAiState(state: AiRuntimeStore): AiResetState | null {
  return state.state;
}

export function selectIsAiFrozen(state: AiRuntimeStore): boolean {
  return Boolean(state.state?.frozen);
}

export function selectAiBadgeLabel(state: AiRuntimeStore): string {
  return state.state?.badgeLabel ?? 'AI status unavailable';
}

export function selectAiBannerMessage(state: AiRuntimeStore): string {
  return state.state?.bannerMessage ?? state.state?.regenerationBanner ?? 'AI is regenerating. Please wait until green.';
}
