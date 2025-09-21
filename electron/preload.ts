// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('[preload] loaded');

contextBridge.exposeInMainWorld('dued8', {
  ping: () => ipcRenderer.invoke('ping'),

  canvas: {
    setToken: (token: string) => ipcRenderer.invoke('canvas:setToken', token),
    getToken: () => ipcRenderer.invoke('canvas:getToken'),
    clearToken: () => ipcRenderer.invoke('canvas:clearToken'),
    testToken: () => ipcRenderer.invoke('canvas:testToken'),
    get: (payload: { path: string; query?: Record<string, string | number | boolean> }) =>
      ipcRenderer.invoke('canvas:get', payload)
  },

  students: {
    add: (s: { first_name: string; last_name: string; county: 'Fairfax'|'Sci-Tech' }) =>
      ipcRenderer.invoke('students.add', s),
    list: () => ipcRenderer.invoke('students.list')
  },

  events: {
    upsert: (name: string, event_date: string) =>
      ipcRenderer.invoke('events.upsert', name, event_date)
  },

  attendance: {
    set: (student_id: number, event_id: number, status: 'Present'|'Absent'|'NO AMP') =>
      ipcRenderer.invoke('attendance.set', student_id, event_id, status)
  },

  files: {
    // PHASE 2: Allow renderer to hand uploaded file paths to the secure main process.
    processUploads: (files: Array<{ path: string; name: string; type?: string }>) =>
      ipcRenderer.invoke('files:processUploads', files)
  },

  assignments: {
    fetchInstructorContext: (payload: { assignmentId: number; courseId: number }) =>
      ipcRenderer.invoke('assignments:fetchInstructorContext', payload)
  },

  flashcards: {
    listDecks: () => ipcRenderer.invoke('flashcards:listDecks'),
    getDeck: (deckId: string) => ipcRenderer.invoke('flashcards:getDeck', { deckId }),
    createDeck: (payload: { title: string; scope: 'class' | 'general'; classId?: string; tags?: string[] }) =>
      ipcRenderer.invoke('flashcards:createDeck', payload),
    updateDeck: (payload: {
      deckId: string;
      title?: string;
      scope?: 'class' | 'general';
      classId?: string | null;
      tags?: string[];
      cardIds?: string[];
    }) => ipcRenderer.invoke('flashcards:updateDeck', payload),
    deleteDeck: (deckId: string) => ipcRenderer.invoke('flashcards:deleteDeck', { deckId }),
    listCards: (payload: { deckId: string; sort?: 'recent' | 'alphabetical' | 'studied' }) =>
      ipcRenderer.invoke('flashcards:listCards', payload),
    createCard: (payload: { deckId: string; front: string; back: string; tags?: string[]; sourceIds?: string[] }) =>
      ipcRenderer.invoke('flashcards:createCard', payload),
    updateCard: (payload: {
      cardId: string;
      front?: string;
      back?: string;
      tags?: string[];
      sourceIds?: string[];
      studiedCount?: number;
      lastStudiedAt?: string | null;
    }) => ipcRenderer.invoke('flashcards:updateCard', payload),
    deleteCard: (cardId: string) => ipcRenderer.invoke('flashcards:deleteCard', { cardId }),
    moveCards: (payload: {
      cardIds: string[];
      targetDeckId: string;
      position?: number | 'start' | 'end';
    }) => ipcRenderer.invoke('flashcards:moveCards', payload),
    mergeDecks: (payload: { sourceDeckId: string; targetDeckId: string }) =>
      ipcRenderer.invoke('flashcards:mergeDecks', payload),
    search: (query: string) => ipcRenderer.invoke('flashcards:search', { query }),
    saveSource: (payload: {
      id?: string;
      type: 'paste' | 'upload';
      filename?: string;
      mimeType?: string;
      textExtract: string;
      createdAt?: string;
    }) => ipcRenderer.invoke('flashcards:saveSource', payload),
    getSource: (id: string) => ipcRenderer.invoke('flashcards:getSource', { id }),
    quota: {
      check: (userId: string) => ipcRenderer.invoke('flashcards:quota:check', { userId }),
      increment: (userId: string, amount: number) =>
        ipcRenderer.invoke('flashcards:quota:increment', { userId, amount })
    }
  }
});
