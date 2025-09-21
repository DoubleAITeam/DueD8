export type DeckScope = 'class' | 'general';

export interface Deck {
  id: string;
  title: string;
  scope: DeckScope;
  classId?: string;
  tags: string[];
  cardIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  tags: string[];
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
  studiedCount?: number;
  lastStudiedAt?: string | null;
}

export interface SourceAsset {
  id: string;
  type: 'paste' | 'upload';
  filename?: string;
  mimeType?: string;
  textExtract: string;
  createdAt: string;
}

export interface SaveSourceAssetInput {
  id?: string;
  type: 'paste' | 'upload';
  filename?: string;
  mimeType?: string;
  textExtract: string;
  createdAt?: string;
}

export type FlashcardGenerationStyle = 'definitions' | 'concepts' | 'process steps' | 'formulas';

export interface FlashcardGenerationResult {
  front: string;
  back: string;
  tags: string[];
}

export interface FlashcardQuotaInfo {
  userId: string;
  used: number;
  limit: number;
  resetAt: string | null;
  remaining: number;
  allowed: boolean;
}

export interface CreateDeckInput {
  title: string;
  scope: DeckScope;
  classId?: string;
  tags?: string[];
}

export interface UpdateDeckInput {
  title?: string;
  scope?: DeckScope;
  classId?: string | null;
  tags?: string[];
  cardIds?: string[];
}

export interface CreateCardInput {
  deckId: string;
  front: string;
  back: string;
  tags?: string[];
  sourceIds?: string[];
}

export interface UpdateCardInput {
  front?: string;
  back?: string;
  tags?: string[];
  sourceIds?: string[];
  studiedCount?: number;
  lastStudiedAt?: string | null;
}

export interface CheckQuotaRequest {
  userId: string;
}

export interface IncrementQuotaRequest {
  userId: string;
  amount: number;
}

export interface MoveCardsRequest {
  cardIds: string[];
  targetDeckId: string;
  position?: number | 'start' | 'end';
}

export interface MergeDecksRequest {
  sourceDeckId: string;
  targetDeckId: string;
}

export interface SearchCardsResult {
  card: Card;
  deck: Deck;
}

export type CardSortOrder = 'recent' | 'alphabetical' | 'studied';

export interface ListCardsOptions {
  sort?: CardSortOrder;
}
