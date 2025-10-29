import { create } from 'zustand';
import type {
  AIChatMode,
  AIMessage,
  AIRetrievalHit,
  AICitation
} from '../../shared/types/ai';

export type ChatMemory = {
  userPreferences?: string;
  recentTurns: string[];
};

export type ChatState = {
  chatId: string;
  messages: AIMessage[];
  mode: AIChatMode;
  isStreaming: boolean;
  activeMessageId: string | null;
  selectedCourseId?: string;
  error: string | null;
  memory: ChatMemory;
  retrievalHits: Record<string, AIRetrievalHit[]>;
  setMode: (mode: AIChatMode) => void;
  setCourseId: (courseId?: string) => void;
  setError: (message: string | null) => void;
  beginUserTurn: (content: string) => { userId: string; assistantId: string };
  appendAssistant: (messageId: string, delta: string) => void;
  completeAssistant: (messageId: string, citations: AICitation[]) => void;
  setStreaming: (value: boolean, messageId?: string | null) => void;
  recordRetrievalHits: (messageId: string, hits: AIRetrievalHit[]) => void;
  reset: () => void;
};

const generateId = () => `chat_${Math.random().toString(36).slice(2, 11)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  chatId: generateId(),
  messages: [],
  mode: 'basic',
  isStreaming: false,
  activeMessageId: null,
  selectedCourseId: undefined,
  error: null,
  memory: {
    recentTurns: []
  },
  retrievalHits: {},
  setMode: (mode) => set({ mode }),
  setCourseId: (courseId) => set({ selectedCourseId: courseId ?? undefined }),
  setError: (message) => set({ error: message }),
  beginUserTurn: (content: string) => {
    const userId = generateId();
    const assistantId = generateId();
    const createdAt = Date.now();
    const userMessage: AIMessage = {
      id: userId,
      role: 'user',
      content,
      createdAt
    };
    const assistantMessage: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: createdAt + 1
    };
    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      activeMessageId: assistantId,
      memory: {
        ...state.memory,
        recentTurns: [...state.memory.recentTurns, content].slice(-8)
      }
    }));
    return { userId, assistantId };
  },
  appendAssistant: (messageId, delta) => {
    if (!delta) {
      return;
    }
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, content: `${msg.content}${delta}` }
          : msg
      )
    }));
  },
  completeAssistant: (messageId, citations) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId
          ? { ...msg, citations, createdAt: Date.now() }
          : msg
      ),
      isStreaming: false,
      activeMessageId: null
    }));
  },
  setStreaming: (value, messageId) => set({ isStreaming: value, activeMessageId: messageId ?? null }),
  recordRetrievalHits: (messageId, hits) => {
    set((state) => ({
      retrievalHits: { ...state.retrievalHits, [messageId]: hits }
    }));
  },
  reset: () =>
    set({
      chatId: generateId(),
      messages: [],
      isStreaming: false,
      activeMessageId: null,
      retrievalHits: {},
      memory: { recentTurns: [] }
    })
}));
