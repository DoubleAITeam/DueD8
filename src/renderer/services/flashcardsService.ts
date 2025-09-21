import type {
  Card,
  CardSortOrder,
  CreateCardInput,
  CreateDeckInput,
  Deck,
  FlashcardQuotaInfo,
  ListCardsOptions,
  MergeDecksRequest,
  MoveCardsRequest,
  SaveSourceAssetInput,
  SearchCardsResult,
  SourceAsset,
  UpdateCardInput,
  UpdateDeckInput
} from '../../shared/flashcards';
import type { IpcResult } from '../../shared/ipc';
import { getPlatformBridge } from '../../lib/platformBridge';
import { rendererError } from '../../lib/logger';

function assertOk<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    const error = new Error(result.error || 'Flashcard service error');
    (error as Error & { status?: number }).status = result.status;
    throw error;
  }
  return result.data;
}

function bridge() {
  const platform = getPlatformBridge();
  if (!platform.flashcards) {
    throw new Error('Flashcards API is unavailable');
  }
  return platform.flashcards;
}

async function wrap<T>(fn: () => Promise<IpcResult<T>>): Promise<T> {
  try {
    const result = await fn();
    return assertOk(result);
  } catch (error) {
    rendererError('Flashcards service call failed', error);
    throw error;
  }
}

export async function listDecks(): Promise<Deck[]> {
  return wrap(() => bridge().listDecks());
}

export async function getDeck(deckId: string): Promise<Deck> {
  return wrap(() => bridge().getDeck(deckId));
}

export async function createDeck(payload: CreateDeckInput): Promise<Deck> {
  return wrap(() => bridge().createDeck(payload));
}

export async function updateDeck(payload: UpdateDeckInput & { deckId: string }): Promise<Deck> {
  return wrap(() => bridge().updateDeck(payload));
}

export async function deleteDeck(deckId: string): Promise<void> {
  await wrap(() => bridge().deleteDeck(deckId));
}

export async function listCards(deckId: string, options: ListCardsOptions = {}): Promise<Card[]> {
  return wrap(() => bridge().listCards({ deckId, sort: options.sort as CardSortOrder | undefined }));
}

export async function createCard(payload: CreateCardInput): Promise<Card> {
  return wrap(() => bridge().createCard(payload));
}

export async function updateCard(payload: UpdateCardInput & { cardId: string }): Promise<Card> {
  return wrap(() => bridge().updateCard(payload));
}

export async function deleteCard(cardId: string): Promise<void> {
  await wrap(() => bridge().deleteCard(cardId));
}

export async function moveCards(payload: MoveCardsRequest): Promise<Deck> {
  return wrap(() => bridge().moveCards(payload));
}

export async function mergeDecks(payload: MergeDecksRequest): Promise<Deck> {
  return wrap(() => bridge().mergeDecks(payload));
}

export async function searchCards(query: string): Promise<SearchCardsResult[]> {
  return wrap(() => bridge().search(query));
}

export async function saveSourceAsset(payload: SaveSourceAssetInput): Promise<SourceAsset> {
  return wrap(() => bridge().saveSource(payload));
}

export async function getSourceAsset(id: string): Promise<SourceAsset> {
  return wrap(() => bridge().getSource(id));
}

export async function checkQuota(userId: string): Promise<FlashcardQuotaInfo> {
  return wrap(() => bridge().quota.check(userId));
}

export async function incrementQuota(userId: string, amount: number): Promise<FlashcardQuotaInfo> {
  return wrap(() => bridge().quota.increment(userId, amount));
}
