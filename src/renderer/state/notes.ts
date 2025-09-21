import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type NoteContentType = 'text' | 'image' | 'audio';

export type NoteRecord = {
  id: string;
  classId: string;
  contentType: NoteContentType;
  rawInputLink?: string;
  parsedNotes: string[];
  confirmed: boolean;
  createdAt: number;
  title: string;
  sourceName?: string;
  transcript?: string;
  tags: string[];
  useForFlashcards: boolean;
  useForStudyPlan: boolean;
};

type AddNoteInput = {
  classId: string;
  contentType: NoteContentType;
  parsedNotes: string[];
  rawInputLink?: string;
  title?: string;
  sourceName?: string;
  transcript?: string;
  tags?: string[];
  confirmed?: boolean;
  createdAt?: number;
  useForFlashcards?: boolean;
  useForStudyPlan?: boolean;
};

type NotesState = {
  notes: NoteRecord[];
  addNote: (note: AddNoteInput) => string;
  updateNote: (id: string, updates: Partial<Omit<NoteRecord, 'id' | 'classId' | 'contentType' | 'createdAt'>>) => void;
  toggleFlashcards: (id: string, value?: boolean) => void;
  toggleStudyPlan: (id: string, value?: boolean) => void;
  getNotesByClass: (classId: string) => NoteRecord[];
};

export const GENERAL_NOTE_CLASS_ID = 'general';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}

function normaliseBlocks(blocks: string[]): string[] {
  return blocks.map((block) => block.trim()).filter((block) => block.length > 0);
}

function resolveTitle(input: AddNoteInput, stampedAt: number): string {
  if (input.title && input.title.trim().length > 0) {
    return input.title.trim();
  }

  const label = (() => {
    switch (input.contentType) {
      case 'text':
        return 'Typed notes';
      case 'image':
        return 'Image notes';
      case 'audio':
        return 'Audio notes';
      default:
        return 'Study notes';
    }
  })();

  return `${label} · ${dateFormatter.format(new Date(stampedAt))}`;
}

const storage = typeof window !== 'undefined' ? createJSONStorage(() => window.localStorage) : undefined;

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      addNote: (note) => {
        const createdAt = note.createdAt ?? Date.now();
        const record: NoteRecord = {
          id: createId('note'),
          classId: note.classId,
          contentType: note.contentType,
          rawInputLink: note.rawInputLink,
          parsedNotes: normaliseBlocks(note.parsedNotes),
          confirmed: note.confirmed ?? true,
          createdAt,
          title: resolveTitle(note, createdAt),
          sourceName: note.sourceName,
          transcript: note.transcript,
          tags: note.tags ?? [],
          useForFlashcards: note.useForFlashcards ?? false,
          useForStudyPlan: note.useForStudyPlan ?? false
        };

        set((state) => ({
          notes: [record, ...state.notes].sort((a, b) => b.createdAt - a.createdAt)
        }));

        return record.id;
      },
      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((note) => {
            if (note.id !== id) return note;
            return {
              ...note,
              ...updates,
              parsedNotes: updates.parsedNotes ? normaliseBlocks(updates.parsedNotes) : note.parsedNotes,
              tags: updates.tags ?? note.tags,
              title:
                typeof updates.title === 'string' && updates.title.trim().length > 0
                  ? updates.title.trim()
                  : note.title
            };
          })
        }));
      },
      toggleFlashcards: (id, value) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  useForFlashcards: typeof value === 'boolean' ? value : !note.useForFlashcards
                }
              : note
          )
        }));
      },
      toggleStudyPlan: (id, value) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  useForStudyPlan: typeof value === 'boolean' ? value : !note.useForStudyPlan
                }
              : note
          )
        }));
      },
      getNotesByClass: (classId) => {
        if (classId === 'all') {
          return get().notes;
        }
        return get().notes.filter((note) => note.classId === classId);
      }
    }),
    {
      name: 'dued8-note-library',
      version: 1,
      storage
    }
  )
);

export function useNotesByClass(classId: string) {
  return useNotesStore((state) => {
    if (classId === 'all') {
      return state.notes;
    }
    return state.notes.filter((note) => note.classId === classId);
  });
}

export function useNoteById(noteId: string) {
  return useNotesStore((state) => state.notes.find((note) => note.id === noteId));
}

export function useHasNotes() {
  return useNotesStore((state) => state.notes.length > 0);
}
