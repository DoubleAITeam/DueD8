import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type UIState = {
  chatOpen: boolean;
  unreadCount: number;
  openChat: () => void;
  minimizeChat: () => void;
  incUnread: () => void;
  clearUnread: () => void;
};

const storage = typeof window !== 'undefined'
  ? createJSONStorage(() => window.localStorage)
  : undefined;

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      chatOpen: false,
      unreadCount: 0,
      openChat: () => set(() => ({ chatOpen: true })),
      minimizeChat: () => set(() => ({ chatOpen: false })),
      incUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
      clearUnread: () => set(() => ({ unreadCount: 0 }))
    }),
    {
      name: 'dued8-ui',
      storage
    }
  )
);
