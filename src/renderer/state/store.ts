// state/store.ts
import { create } from 'zustand';

export type Profile = { name?: string; primary_email?: string };

export type ChatMessage = {
  id: string;
  author: 'user' | 'assistant';
  text: string;
  timestamp: number;
};

const CHAT_MINIMIZED_KEY = 'dued8.chat.minimized';

function readInitialChatOpen() {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(CHAT_MINIMIZED_KEY);
    if (stored === null) return true;
    return stored !== 'true';
  } catch (error) {
    console.warn('Failed to read chat minimized state', error);
    return true;
  }
}

type AppState = {
  connected: boolean;
  profile: Profile | null;
  toast: string | null;
  chatOpen: boolean;
  chatUnread: number;
  chatMessages: ChatMessage[];
  setConnected: (v: boolean) => void;
  setProfile: (p: Profile | null) => void;
  setToast: (message: string | null) => void;
  setChatOpen: (open: boolean) => void;
  toggleChat: () => void;
  sendChatMessage: (text: string) => void;
  receiveChatMessage: (text: string) => void;
};

export const useStore = create<AppState>((set) => ({
  connected: false,
  profile: null,
  toast: null,
  chatOpen: readInitialChatOpen(),
  chatUnread: 0,
  chatMessages: [
    {
      id: 'welcome',
      author: 'assistant',
      text: 'Hi there! I am your DueD8 helper bot. Ask me anything about your assignments.',
      timestamp: Date.now()
    }
  ],
  setConnected: (v) => set({ connected: v }),
  setProfile: (profile) => set({ profile }),
  setToast: (toast) => set({ toast }),
  setChatOpen: (open) =>
    set((state) => {
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(CHAT_MINIMIZED_KEY, (!open).toString());
        } catch (error) {
          console.warn('Failed to persist chat minimized state', error);
        }
      }
      return {
        chatOpen: open,
        chatUnread: open ? 0 : state.chatUnread
      };
    }),
  toggleChat: () =>
    set((state) => {
      const open = !state.chatOpen;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(CHAT_MINIMIZED_KEY, (!open).toString());
        } catch (error) {
          console.warn('Failed to persist chat minimized state', error);
        }
      }
      return {
        chatOpen: open,
        chatUnread: open ? 0 : state.chatUnread
      };
    }),
  sendChatMessage: (text) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          id: `user-${Date.now()}`,
          author: 'user',
          text,
          timestamp: Date.now()
        }
      ],
      chatUnread: 0
    })),
  receiveChatMessage: (text) =>
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          id: `assistant-${Date.now()}`,
          author: 'assistant',
          text,
          timestamp: Date.now()
        }
      ],
      chatUnread: state.chatOpen ? 0 : state.chatUnread + 1
    }))
}));
