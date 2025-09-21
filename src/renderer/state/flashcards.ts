import { create } from 'zustand';
import {
  type Card,
  type CardSortOrder,
  type CreateCardInput,
  type CreateDeckInput,
  type Deck,
  type FlashcardQuotaInfo,
  type ListCardsOptions,
  type MergeDecksRequest,
  type MoveCardsRequest,
  type SaveSourceAssetInput,
  type SearchCardsResult,
  type SourceAsset,
  type UpdateCardInput,
  type UpdateDeckInput
} from '../../shared/flashcards';
import {
  checkQuota,
  createCard,
  createDeck,
  deleteCard,
  deleteDeck,
  getDeck,
  getSourceAsset,
  incrementQuota,
  listCards,
  listDecks,
  mergeDecks,
  moveCards,
  saveSourceAsset,
  searchCards,
  updateCard,
  updateDeck
} from '../services/flashcardsService';
import { rendererError, rendererLog } from '../../lib/logger';

type FlashcardsTab = 'cards' | 'generate' | 'import';

type CardMap = Record<string, Card>;

type FlashcardsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  decks: Record<string, Deck>;
  deckOrder: string[];
  cardsByDeck: Record<string, CardMap>;
  cardOrderByDeck: Record<string, string[]>;
  cardSortByDeck: Record<string, CardSortOrder>;
  sources: Record<string, SourceAsset>;
  selectedDeckId: string | null;
  selectedCardId: string | null;
  activeTab: FlashcardsTab;
  searchQuery: string;
  searchResults: SearchCardsResult[];
  quota: FlashcardQuotaInfo | null;
  error: string | null;
  pendingActions: number;

  initialise: () => Promise<void>;
  refreshDecks: () => Promise<void>;
  selectDeck: (deckId: string | null) => void;
  selectCard: (cardId: string | null) => void;
  setActiveTab: (tab: FlashcardsTab) => void;
  setDeckSort: (deckId: string, sort: CardSortOrder) => Promise<void>;
  fetchCards: (deckId: string, options?: ListCardsOptions) => Promise<Card[]>;
  createDeck: (input: CreateDeckInput) => Promise<Deck | null>;
  updateDeck: (deckId: string, updates: UpdateDeckInput) => Promise<Deck | null>;
  deleteDeck: (deckId: string) => Promise<boolean>;
  createCard: (input: CreateCardInput) => Promise<Card | null>;
  updateCard: (cardId: string, updates: UpdateCardInput) => Promise<Card | null>;
  deleteCard: (cardId: string) => Promise<boolean>;
  moveCards: (request: MoveCardsRequest) => Promise<boolean>;
  mergeDecks: (request: MergeDecksRequest) => Promise<boolean>;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;
  persistSource: (input: SaveSourceAssetInput) => Promise<SourceAsset>;
  loadSource: (id: string) => Promise<SourceAsset | null>;
  refreshQuota: (userId: string) => Promise<FlashcardQuotaInfo | null>;
  consumeQuota: (userId: string, amount: number) => Promise<FlashcardQuotaInfo | null>;
  setError: (error: string | null) => void;
};

const DEFAULT_SORT: CardSortOrder = 'recent';

function sortDeckIds(decks: Record<string, Deck>): string[] {
  return Object.values(decks)
    .sort((a, b) => {
      const titleCompare = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      if (titleCompare !== 0) return titleCompare;
      return (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '');
    })
    .map((deck) => deck.id);
}

function sortCards(cards: Card[], sort: CardSortOrder): Card[] {
  if (sort === 'alphabetical') {
    return [...cards].sort((a, b) => a.front.localeCompare(b.front, undefined, { sensitivity: 'base' }));
  }
  if (sort === 'studied') {
    return [...cards].sort((a, b) => {
      const countDiff = (b.studiedCount ?? 0) - (a.studiedCount ?? 0);
      if (countDiff !== 0) return countDiff;
      const aTime = a.lastStudiedAt ?? '';
      const bTime = b.lastStudiedAt ?? '';
      if (aTime === bTime) {
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      }
      return (bTime ?? '').localeCompare(aTime ?? '');
    });
  }
  return [...cards].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

function buildCardState(cards: Card[], sort: CardSortOrder) {
  const ordered = sortCards(cards, sort);
  const map: CardMap = {};
  ordered.forEach((card) => {
    map[card.id] = card;
  });
  return {
    map,
    order: ordered.map((card) => card.id)
  };
}

export const useFlashcardsStore = create<FlashcardsState>((set, get) => {
  const beginAction = () => set((state) => ({ pendingActions: state.pendingActions + 1 }));
  const endAction = () => set((state) => ({ pendingActions: Math.max(0, state.pendingActions - 1) }));

  async function hydrateDecks() {
    beginAction();
    try {
      const decks = await listDecks();
      set((state) => {
        const deckMap: Record<string, Deck> = {};
        decks.forEach((deck) => {
          deckMap[deck.id] = deck;
        });
        const deckOrder = sortDeckIds(deckMap);
        const selectedDeckId = deckOrder.length ? deckOrder[0] : null;
        return {
          ...state,
          status: 'ready',
          decks: deckMap,
          deckOrder,
          selectedDeckId,
          selectedCardId: null
        };
      });
      return decks;
    } catch (error) {
      rendererError('Failed to hydrate decks', error);
      set((state) => ({ ...state, status: 'error', error: (error as Error).message || 'Unable to load decks' }));
      throw error;
    } finally {
      endAction();
    }
  }

  async function ensureDeckCards(deckId: string, options?: ListCardsOptions) {
    const currentMap = get().cardsByDeck[deckId];
    if (currentMap && !options) {
      return Object.values(currentMap);
    }
    beginAction();
    try {
      const sort = options?.sort ?? get().cardSortByDeck[deckId] ?? DEFAULT_SORT;
      const cards = await listCards(deckId, { sort });
      set((state) => {
        const { map, order } = buildCardState(cards, sort);
        const nextCardsByDeck = { ...state.cardsByDeck, [deckId]: map };
        const nextOrderByDeck = { ...state.cardOrderByDeck, [deckId]: order };
        const nextSortByDeck = { ...state.cardSortByDeck, [deckId]: sort };
        const decks = state.decks[deckId]
          ? {
              ...state.decks,
              [deckId]: {
                ...state.decks[deckId],
                cardIds: order
              }
            }
          : state.decks;
        return {
          ...state,
          decks,
          cardsByDeck: nextCardsByDeck,
          cardOrderByDeck: nextOrderByDeck,
          cardSortByDeck: nextSortByDeck
        };
      });
      return cards;
    } catch (error) {
      rendererError('Failed to load cards', error);
      set((state) => ({ ...state, error: (error as Error).message || 'Unable to load cards' }));
      throw error;
    } finally {
      endAction();
    }
  }

  return {
    status: 'idle',
    decks: {},
    deckOrder: [],
    cardsByDeck: {},
    cardOrderByDeck: {},
    cardSortByDeck: {},
    sources: {},
    selectedDeckId: null,
    selectedCardId: null,
    activeTab: 'cards',
    searchQuery: '',
    searchResults: [],
    quota: null,
    error: null,
    pendingActions: 0,

    initialise: async () => {
      set((state) => ({ ...state, status: 'loading', error: null }));
      const decks = await hydrateDecks();
      const firstDeck = decks.length ? decks[0] : null;
      if (firstDeck) {
        await ensureDeckCards(firstDeck.id);
      }
    },

    refreshDecks: async () => {
      await hydrateDecks();
      const currentDeck = get().selectedDeckId;
      if (currentDeck) {
        await ensureDeckCards(currentDeck);
      }
    },

    selectDeck: (deckId) => {
      set((state) => ({ ...state, selectedDeckId: deckId, selectedCardId: null, activeTab: 'cards' }));
      if (deckId) {
        ensureDeckCards(deckId).catch((error) => rendererError('Failed to ensure deck cards', error));
      }
    },

    selectCard: (cardId) => {
      set((state) => ({ ...state, selectedCardId: cardId }));
    },

    setActiveTab: (tab) => {
      set((state) => ({ ...state, activeTab: tab }));
    },

    setDeckSort: async (deckId, sort) => {
      const cardsMap = get().cardsByDeck[deckId];
      if (cardsMap) {
        const order = sortCards(Object.values(cardsMap), sort).map((card) => card.id);
        set((state) => ({
          ...state,
          cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: order },
          cardSortByDeck: { ...state.cardSortByDeck, [deckId]: sort }
        }));
      }
      await ensureDeckCards(deckId, { sort });
    },

    fetchCards: ensureDeckCards,

    createDeck: async (input) => {
      const now = new Date().toISOString();
      const tempId = `temp-deck-${Date.now()}`;
      const optimisticDeck: Deck = {
        id: tempId,
        title: input.title.trim(),
        scope: input.scope,
        classId: input.scope === 'class' ? input.classId : undefined,
        tags: input.tags ?? [],
        cardIds: [],
        createdAt: now,
        updatedAt: now
      };

      const prevDecks = { ...get().decks };
      const prevOrder = [...get().deckOrder];
      const prevSelected = get().selectedDeckId;

      set((state) => {
        const decks = { ...state.decks, [tempId]: optimisticDeck };
        const deckOrder = sortDeckIds(decks);
        return {
          ...state,
          decks,
          deckOrder,
          selectedDeckId: tempId,
          selectedCardId: null
        };
      });

      beginAction();
      try {
        const deck = await createDeck(input);
        set((state) => {
          const decks = { ...state.decks };
          delete decks[tempId];
          decks[deck.id] = deck;
          const deckOrder = sortDeckIds(decks);
          return {
            ...state,
            decks,
            deckOrder,
            selectedDeckId: deck.id,
            selectedCardId: null
          };
        });
        return deck;
      } catch (error) {
        rendererError('Failed to create deck', error);
        set((state) => ({
          ...state,
          decks: prevDecks,
          deckOrder: prevOrder,
          selectedDeckId: prevSelected,
          selectedCardId: null,
          error: (error as Error).message || 'Unable to create deck'
        }));
        return null;
      } finally {
        endAction();
      }
    },

    updateDeck: async (deckId, updates) => {
      const currentDeck = get().decks[deckId];
      if (!currentDeck) {
        return null;
      }
      const prevDeck = { ...currentDeck };
      const prevDecks = { ...get().decks };
      const prevOrder = [...get().deckOrder];

      const optimisticDeck: Deck = {
        ...currentDeck,
        ...updates,
        classId: updates.scope === 'general'
          ? undefined
          : updates.classId === null
            ? undefined
            : updates.classId ?? currentDeck.classId,
        tags: updates.tags ?? currentDeck.tags,
        updatedAt: new Date().toISOString()
      };

      set((state) => {
        const decks = { ...state.decks, [deckId]: optimisticDeck };
        const deckOrder = sortDeckIds(decks);
        return {
          ...state,
          decks,
          deckOrder
        };
      });

      beginAction();
      try {
        const deck = await updateDeck({ deckId, ...updates });
        set((state) => {
          const decks = { ...state.decks, [deckId]: deck };
          const deckOrder = sortDeckIds(decks);
          return {
            ...state,
            decks,
            deckOrder
          };
        });
        return deck;
      } catch (error) {
        rendererError('Failed to update deck', error);
        set((state) => ({
          ...state,
          decks: prevDecks,
          deckOrder: prevOrder,
          error: (error as Error).message || 'Unable to update deck'
        }));
        return prevDeck;
      } finally {
        endAction();
      }
    },

    deleteDeck: async (deckId) => {
      if (!get().decks[deckId]) {
        return false;
      }
      const prevDecks = { ...get().decks };
      const prevOrder = [...get().deckOrder];
      const prevCardsByDeck = { ...get().cardsByDeck };
      const prevCardOrderByDeck = { ...get().cardOrderByDeck };
      const prevSelected = get().selectedDeckId;
      const prevSelectedCard = get().selectedCardId;

      set((state) => {
        const decks = { ...state.decks };
        delete decks[deckId];
        const deckOrder = state.deckOrder.filter((id) => id !== deckId);
        const cardsByDeck = { ...state.cardsByDeck };
        delete cardsByDeck[deckId];
        const cardOrderByDeck = { ...state.cardOrderByDeck };
        delete cardOrderByDeck[deckId];
        let selectedDeckId = state.selectedDeckId;
        let selectedCardId = state.selectedCardId;
        if (selectedDeckId === deckId) {
          selectedDeckId = deckOrder.length ? deckOrder[0] : null;
          selectedCardId = null;
        }
        return {
          ...state,
          decks,
          deckOrder,
          cardsByDeck,
          cardOrderByDeck,
          selectedDeckId,
          selectedCardId
        };
      });

      beginAction();
      try {
        await deleteDeck(deckId);
        rendererLog('flashcards deck deleted', deckId);
        const nextSelected = get().selectedDeckId;
        if (nextSelected) {
          await ensureDeckCards(nextSelected);
        }
        return true;
      } catch (error) {
        rendererError('Failed to delete deck', error);
        set((state) => ({
          ...state,
          decks: prevDecks,
          deckOrder: prevOrder,
          cardsByDeck: prevCardsByDeck,
          cardOrderByDeck: prevCardOrderByDeck,
          selectedDeckId: prevSelected,
          selectedCardId: prevSelectedCard,
          error: (error as Error).message || 'Unable to delete deck'
        }));
        return false;
      } finally {
        endAction();
      }
    },

    createCard: async (input) => {
      const deckId = input.deckId;
      const cardsMap = get().cardsByDeck[deckId] ?? {};
      const prevCardsMap = { ...cardsMap };
      const prevOrder = [...(get().cardOrderByDeck[deckId] ?? [])];
      const sort = get().cardSortByDeck[deckId] ?? DEFAULT_SORT;
      const now = new Date().toISOString();
      const tempId = `temp-card-${Date.now()}`;

      const optimisticCard: Card = {
        id: tempId,
        deckId,
        front: input.front,
        back: input.back,
        tags: input.tags ?? [],
        sourceIds: input.sourceIds ?? [],
        createdAt: now,
        updatedAt: now,
        studiedCount: 0,
        lastStudiedAt: undefined
      };

      set((state) => {
        const deckCards = { ...(state.cardsByDeck[deckId] ?? {}), [tempId]: optimisticCard };
        const order = sortCards(Object.values(deckCards), sort).map((card) => card.id);
        const cardsByDeck = { ...state.cardsByDeck, [deckId]: deckCards };
        const cardOrderByDeck = { ...state.cardOrderByDeck, [deckId]: order };
        const decks = state.decks[deckId]
          ? {
              ...state.decks,
              [deckId]: {
                ...state.decks[deckId],
                cardIds: order,
                updatedAt: now
              }
            }
          : state.decks;
        return {
          ...state,
          cardsByDeck,
          cardOrderByDeck,
          decks,
          selectedCardId: optimisticCard.id
        };
      });

      beginAction();
      try {
        const card = await createCard(input);
        set((state) => {
          const deckCards = { ...(state.cardsByDeck[deckId] ?? {}) };
          delete deckCards[tempId];
          deckCards[card.id] = card;
          const order = sortCards(Object.values(deckCards), sort).map((item) => item.id);
          return {
            ...state,
            cardsByDeck: { ...state.cardsByDeck, [deckId]: deckCards },
            cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: order },
            decks: state.decks[deckId]
              ? {
                  ...state.decks,
                  [deckId]: {
                    ...state.decks[deckId],
                    cardIds: order,
                    updatedAt: card.updatedAt
                  }
                }
              : state.decks,
            selectedCardId: card.id
          };
        });
        return card;
      } catch (error) {
        rendererError('Failed to create card', error);
        set((state) => ({
          ...state,
          cardsByDeck: { ...state.cardsByDeck, [deckId]: prevCardsMap },
          cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: prevOrder },
          selectedCardId: prevOrder[0] ?? null,
          error: (error as Error).message || 'Unable to create card'
        }));
        return null;
      } finally {
        endAction();
      }
    },

    updateCard: async (cardId, updates) => {
      const deckId = get().selectedDeckId;
      if (!deckId) return null;
      const cardsMap = get().cardsByDeck[deckId] ?? {};
      if (!cardsMap[cardId]) return null;
      const prevCard = { ...cardsMap[cardId] };
      const prevCardsMap = { ...cardsMap };
      const prevOrder = [...(get().cardOrderByDeck[deckId] ?? [])];
      const sort = get().cardSortByDeck[deckId] ?? DEFAULT_SORT;
      const optimisticCard: Card = {
        ...prevCard,
        ...updates,
        tags: updates.tags ?? prevCard.tags,
        sourceIds: updates.sourceIds ?? prevCard.sourceIds,
        updatedAt: new Date().toISOString()
      };

      set((state) => {
        const deckCards = { ...(state.cardsByDeck[deckId] ?? {}), [cardId]: optimisticCard };
        const order = sortCards(Object.values(deckCards), sort).map((card) => card.id);
        return {
          ...state,
          cardsByDeck: { ...state.cardsByDeck, [deckId]: deckCards },
          cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: order }
        };
      });

      beginAction();
      try {
        const card = await updateCard({ cardId, ...updates });
        set((state) => {
          const deckCards = { ...(state.cardsByDeck[deckId] ?? {}), [cardId]: card };
          const order = sortCards(Object.values(deckCards), sort).map((item) => item.id);
          return {
            ...state,
            cardsByDeck: { ...state.cardsByDeck, [deckId]: deckCards },
            cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: order }
          };
        });
        return card;
      } catch (error) {
        rendererError('Failed to update card', error);
        set((state) => ({
          ...state,
          cardsByDeck: { ...state.cardsByDeck, [deckId]: prevCardsMap },
          cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: prevOrder },
          error: (error as Error).message || 'Unable to update card'
        }));
        return prevCard;
      } finally {
        endAction();
      }
    },

    deleteCard: async (cardId) => {
      const deckId = get().selectedDeckId;
      if (!deckId) return false;
      const cardsMap = get().cardsByDeck[deckId] ?? {};
      if (!cardsMap[cardId]) return false;
      const prevCardsMap = { ...cardsMap };
      const prevOrder = [...(get().cardOrderByDeck[deckId] ?? [])];
      const prevSelectedCard = get().selectedCardId;

      set((state) => {
        const deckCards = { ...(state.cardsByDeck[deckId] ?? {}) };
        delete deckCards[cardId];
        const order = (state.cardOrderByDeck[deckId] ?? []).filter((id) => id !== cardId);
        return {
          ...state,
          cardsByDeck: { ...state.cardsByDeck, [deckId]: deckCards },
          cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: order },
          selectedCardId: order[0] ?? null
        };
      });

      beginAction();
      try {
        await deleteCard(cardId);
        rendererLog('flashcards card deleted', cardId);
        return true;
      } catch (error) {
        rendererError('Failed to delete card', error);
        set((state) => ({
          ...state,
          cardsByDeck: { ...state.cardsByDeck, [deckId]: prevCardsMap },
          cardOrderByDeck: { ...state.cardOrderByDeck, [deckId]: prevOrder },
          selectedCardId: prevSelectedCard,
          error: (error as Error).message || 'Unable to delete card'
        }));
        return false;
      } finally {
        endAction();
      }
    },

    moveCards: async (request) => {
      const { targetDeckId, cardIds } = request;
      if (!cardIds.length) return false;
      const decks = get().decks;
      const affectedDeckIds = new Set<string>();
      cardIds.forEach((cardId) => {
        Object.entries(get().cardsByDeck).forEach(([deckId, map]) => {
          if (map[cardId]) {
            affectedDeckIds.add(deckId);
          }
        });
      });
      affectedDeckIds.add(targetDeckId);

      const prevCardsByDeck = { ...get().cardsByDeck };
      const prevCardOrderByDeck = { ...get().cardOrderByDeck };
      const sortLookup = get().cardSortByDeck;

      set((state) => {
        const nextCardsByDeck = { ...state.cardsByDeck };
        const nextOrderByDeck = { ...state.cardOrderByDeck };

        affectedDeckIds.forEach((deckId) => {
          const sort = sortLookup[deckId] ?? DEFAULT_SORT;
          const current = { ...(nextCardsByDeck[deckId] ?? {}) };
          if (deckId === targetDeckId) {
            cardIds.forEach((cardId) => {
              const sourceEntry = Object.entries(state.cardsByDeck).find(([, map]) => map[cardId]);
              if (sourceEntry) {
                const [, map] = sourceEntry;
                const card = map[cardId];
                if (card) {
                  current[cardId] = { ...card, deckId: targetDeckId };
                }
              }
            });
          } else {
            cardIds.forEach((cardId) => {
              if (current[cardId]) {
                delete current[cardId];
              }
            });
          }
          nextCardsByDeck[deckId] = current;
          nextOrderByDeck[deckId] = sortCards(Object.values(current), sort).map((card) => card.id);
        });

        return {
          ...state,
          cardsByDeck: nextCardsByDeck,
          cardOrderByDeck: nextOrderByDeck
        };
      });

      beginAction();
      try {
        await moveCards(request);
        await Promise.all(Array.from(affectedDeckIds).map((deckId) => ensureDeckCards(deckId)));
        return true;
      } catch (error) {
        rendererError('Failed to move cards', error);
        set((state) => ({
          ...state,
          cardsByDeck: prevCardsByDeck,
          cardOrderByDeck: prevCardOrderByDeck,
          error: (error as Error).message || 'Unable to move cards'
        }));
        return false;
      } finally {
        endAction();
      }
    },

    mergeDecks: async (request) => {
      beginAction();
      const prevDecks = { ...get().decks };
      const prevDeckOrder = [...get().deckOrder];
      const prevCardsByDeck = { ...get().cardsByDeck };
      const prevCardOrderByDeck = { ...get().cardOrderByDeck };
      try {
        await mergeDecks(request);
        await hydrateDecks();
        await ensureDeckCards(request.targetDeckId);
        return true;
      } catch (error) {
        rendererError('Failed to merge decks', error);
        set((state) => ({
          ...state,
          decks: prevDecks,
          deckOrder: prevDeckOrder,
          cardsByDeck: prevCardsByDeck,
          cardOrderByDeck: prevCardOrderByDeck,
          error: (error as Error).message || 'Unable to merge decks'
        }));
        return false;
      } finally {
        endAction();
      }
    },

    search: async (query) => {
      const value = query.trim();
      set((state) => ({ ...state, searchQuery: value }));
      if (!value) {
        set((state) => ({ ...state, searchResults: [] }));
        return;
      }
      beginAction();
      try {
        const results = await searchCards(value);
        set((state) => ({ ...state, searchResults: results }));
      } catch (error) {
        rendererError('Flashcard search failed', error);
        set((state) => ({ ...state, error: (error as Error).message || 'Search failed' }));
      } finally {
        endAction();
      }
    },

    clearSearch: () => {
      set((state) => ({ ...state, searchQuery: '', searchResults: [] }));
    },

    persistSource: async (input) => {
      beginAction();
      try {
        const asset = await saveSourceAsset(input);
        set((state) => ({ ...state, sources: { ...state.sources, [asset.id]: asset } }));
        return asset;
      } catch (error) {
        rendererError('Failed to save source asset', error);
        set((state) => ({ ...state, error: (error as Error).message || 'Unable to save source' }));
        throw error;
      } finally {
        endAction();
      }
    },

    loadSource: async (id) => {
      if (get().sources[id]) {
        return get().sources[id];
      }
      beginAction();
      try {
        const asset = await getSourceAsset(id);
        set((state) => ({ ...state, sources: { ...state.sources, [asset.id]: asset } }));
        return asset;
      } catch (error) {
        rendererError('Failed to load source asset', error);
        set((state) => ({ ...state, error: (error as Error).message || 'Unable to load source' }));
        return null;
      } finally {
        endAction();
      }
    },

    refreshQuota: async (userId) => {
      beginAction();
      try {
        const quota = await checkQuota(userId);
        set((state) => ({ ...state, quota }));
        return quota;
      } catch (error) {
        rendererError('Failed to refresh flashcard quota', error);
        set((state) => ({ ...state, error: (error as Error).message || 'Unable to refresh quota' }));
        return null;
      } finally {
        endAction();
      }
    },

    consumeQuota: async (userId, amount) => {
      beginAction();
      try {
        const quota = await incrementQuota(userId, amount);
        set((state) => ({ ...state, quota }));
        return quota;
      } catch (error) {
        rendererError('Failed to consume flashcard quota', error);
        set((state) => ({ ...state, error: (error as Error).message || 'Unable to update quota' }));
        return null;
      } finally {
        endAction();
      }
    },

    setError: (error) => {
      set((state) => ({ ...state, error }));
    }
  };
});
