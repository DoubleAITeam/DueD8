import { create } from 'zustand';

export type AIModel = 'basic' | 'advanced';

export type ChatMessage = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  model: AIModel;
  attachments?: ChatAttachment[];
  courseContext?: string;
};

export type ChatAttachment = {
  id: string;
  type: 'file' | 'youtube';
  name: string;
  content?: string; // For file content
  url?: string; // For YouTube links
  size?: number;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  courseContext?: string;
};

export type ChatbotState = {
  // Current session
  currentSessionId: string | null;
  sessions: Record<string, ChatSession>;
  sessionOrder: string[];
  
  // UI state
  selectedModel: AIModel;
  isTyping: boolean;
  error: string | null;
  
  // Actions
  createSession: (title?: string, courseContext?: string) => string;
  deleteSession: (sessionId: string) => void;
  selectSession: (sessionId: string) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  setSelectedModel: (model: AIModel) => void;
  setTyping: (isTyping: boolean) => void;
  setError: (error: string | null) => void;
  clearCurrentSession: () => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
};

const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useChatbotStore = create<ChatbotState>()((set, get) => ({
      // Initial state
      currentSessionId: null,
      sessions: {},
      sessionOrder: [],
      selectedModel: 'basic',
      isTyping: false,
      error: null,

      // Actions
      createSession: (title, courseContext) => {
        const id = generateSessionId();
        const now = new Date();
        const session: ChatSession = {
          id,
          title: title || 'New Chat',
          messages: [],
          createdAt: now,
          updatedAt: now,
          courseContext,
        };

        set((state) => ({
          sessions: { ...state.sessions, [id]: session },
          sessionOrder: [id, ...state.sessionOrder],
          currentSessionId: id,
        }));

        return id;
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const { [sessionId]: deleted, ...remainingSessions } = state.sessions;
          const newOrder = state.sessionOrder.filter(id => id !== sessionId);
          const newCurrentSessionId = state.currentSessionId === sessionId 
            ? (newOrder.length > 0 ? newOrder[0] : null)
            : state.currentSessionId;

          return {
            sessions: remainingSessions,
            sessionOrder: newOrder,
            currentSessionId: newCurrentSessionId,
          };
        });
      },

      selectSession: (sessionId) => {
        set({ currentSessionId: sessionId });
      },

      addMessage: (messageData) => {
        const message: ChatMessage = {
          ...messageData,
          id: generateMessageId(),
          timestamp: new Date(),
        };

        set((state) => {
          const currentSession = state.currentSessionId 
            ? state.sessions[state.currentSessionId] 
            : null;

          if (!currentSession) return state;

          const updatedSession = {
            ...currentSession,
            messages: [...currentSession.messages, message],
            updatedAt: new Date(),
          };

          return {
            sessions: {
              ...state.sessions,
              [currentSession.id]: updatedSession,
            },
          };
        });
      },

      updateMessage: (messageId, updates) => {
        set((state) => {
          const currentSession = state.currentSessionId 
            ? state.sessions[state.currentSessionId] 
            : null;

          if (!currentSession) return state;

          const updatedMessages = currentSession.messages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );

          const updatedSession = {
            ...currentSession,
            messages: updatedMessages,
            updatedAt: new Date(),
          };

          return {
            sessions: {
              ...state.sessions,
              [currentSession.id]: updatedSession,
            },
          };
        });
      },

      setSelectedModel: (model) => {
        set({ selectedModel: model });
      },

      setTyping: (isTyping) => {
        set({ isTyping });
      },

      setError: (error) => {
        set({ error });
      },

      clearCurrentSession: () => {
        set({ currentSessionId: null });
      },

      updateSessionTitle: (sessionId, title) => {
        set((state) => {
          const session = state.sessions[sessionId];
          if (!session) return state;

          return {
            sessions: {
              ...state.sessions,
              [sessionId]: { ...session, title, updatedAt: new Date() },
            },
          };
        });
      },
    })
);
