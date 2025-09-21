import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import type {
  Card,
  CardSortOrder,
  CreateCardInput,
  CreateDeckInput,
  Deck,
  FlashcardQuotaInfo,
  IncrementQuotaRequest,
  ListCardsOptions,
  MergeDecksRequest,
  MoveCardsRequest,
  SaveSourceAssetInput,
  SearchCardsResult,
  SourceAsset,
  UpdateCardInput,
  UpdateDeckInput
} from '../src/shared/flashcards';

const DEFAULT_DECK_TAGS: string[] = [];
const DEFAULT_CARD_TAGS: string[] = [];
const DEFAULT_SOURCE_TYPE = 'paste';
const DEFAULT_QUOTA_LIMIT = 90;

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

type DeckRow = {
  id: string;
  title: string;
  scope: 'class' | 'general';
  class_id: string | null;
  tags: string;
  card_order: string;
  created_at: string;
  updated_at: string;
};

type CardRow = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  tags: string;
  source_ids: string;
  created_at: string;
  updated_at: string;
  studied_count: number;
  last_studied_at: string | null;
};

type SourceRow = {
  id: string;
  type: 'paste' | 'upload';
  filename: string | null;
  mime_type: string | null;
  text_extract: string;
  created_at: string;
};

type QuotaRow = {
  user_id: string;
  used: number;
  quota_limit: number;
  reset_at: string | null;
};

function parseStringArray(value: unknown, fallback: string[] = []): string[] {
  if (typeof value === 'string' && value.trim().length) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === 'string' ? entry : String(entry)))
          .map((entry) => entry.trim())
          .filter(Boolean);
      }
    } catch (error) {
      console.warn('[flashcards] failed to parse string array', error);
    }
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry : String(entry)))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [...fallback];
}

function serialiseStringArray(value: string[]): string {
  return JSON.stringify(value);
}

function normaliseTags(tags: string[] | undefined, fallback: string[]): string[] {
  const values = Array.isArray(tags) ? tags : fallback;
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((tag) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result;
}

function parseDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    title: row.title,
    scope: row.scope,
    classId: row.class_id ?? undefined,
    tags: parseStringArray(row.tags, DEFAULT_DECK_TAGS),
    cardIds: parseStringArray(row.card_order),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseCard(row: CardRow): Card {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    tags: parseStringArray(row.tags, DEFAULT_CARD_TAGS),
    sourceIds: parseStringArray(row.source_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    studiedCount: row.studied_count,
    lastStudiedAt: row.last_studied_at ?? undefined
  };
}

function parseSource(row: SourceRow): SourceAsset {
  return {
    id: row.id,
    type: row.type,
    filename: row.filename ?? undefined,
    mimeType: row.mime_type ?? undefined,
    textExtract: row.text_extract,
    createdAt: row.created_at
  };
}

function ensureDeckExists(deckId: string) {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM flashcard_deck WHERE id = ?')
    .get(deckId) as DeckRow | undefined;
  if (!row) {
    throw new Error(`Deck ${deckId} not found`);
  }
  return row;
}

function ensureCardExists(cardId: string) {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM flashcard_card WHERE id = ?')
    .get(cardId) as CardRow | undefined;
  if (!row) {
    throw new Error(`Card ${cardId} not found`);
  }
  return row;
}

function updateDeckOrder(deckId: string, order: string[]) {
  const db = getDb();
  const cleaned = order.filter((entry, index, array) => array.indexOf(entry) === index);
  db.prepare('UPDATE flashcard_deck SET card_order = ?, updated_at = ? WHERE id = ?').run(
    serialiseStringArray(cleaned),
    nowIso(),
    deckId
  );
}

function insertIntoOrder(order: string[], ids: string[], position?: number | 'start' | 'end') {
  const cleaned = order.filter((id) => !ids.includes(id));
  if (!ids.length) return cleaned;
  let index: number;
  if (position === 'start') {
    index = 0;
  } else if (position === 'end' || position === undefined) {
    index = cleaned.length;
  } else {
    index = Math.max(0, Math.min(position, cleaned.length));
  }
  cleaned.splice(index, 0, ...ids);
  return cleaned;
}

function removeFromOrder(order: string[], ids: string[]) {
  return order.filter((id) => !ids.includes(id));
}

export function createDeck(input: CreateDeckInput): Deck {
  const db = getDb();
  const id = generateId('deck');
  const now = nowIso();
  const tags = serialiseStringArray(normaliseTags(input.tags, DEFAULT_DECK_TAGS));
  db.prepare(
    `INSERT INTO flashcard_deck (id, title, scope, class_id, tags, card_order, created_at, updated_at)
     VALUES (@id, @title, @scope, @classId, @tags, @cardOrder, @createdAt, @updatedAt)`
  ).run({
    id,
    title: input.title.trim(),
    scope: input.scope,
    classId: input.scope === 'class' ? input.classId ?? null : null,
    tags,
    cardOrder: serialiseStringArray([]),
    createdAt: now,
    updatedAt: now
  });
  return parseDeck(ensureDeckExists(id));
}

export function updateDeck(deckId: string, updates: UpdateDeckInput): Deck {
  const db = getDb();
  const current = ensureDeckExists(deckId);
  const now = nowIso();
  const setClauses: string[] = [];
  const params: Record<string, unknown> = { deckId, updatedAt: now };

  if (updates.title !== undefined) {
    setClauses.push('title = @title');
    params.title = updates.title.trim();
  }
  if (updates.scope !== undefined) {
    setClauses.push('scope = @scope');
    params.scope = updates.scope;
    if (updates.scope === 'general' && updates.classId === undefined) {
      updates.classId = null;
    }
  }
  if (updates.classId !== undefined) {
    setClauses.push('class_id = @classId');
    params.classId = updates.classId === null ? null : updates.classId;
  }
  if (updates.tags !== undefined) {
    setClauses.push('tags = @tags');
    params.tags = serialiseStringArray(normaliseTags(updates.tags, DEFAULT_DECK_TAGS));
  }
  if (updates.cardIds !== undefined) {
    setClauses.push('card_order = @cardOrder');
    params.cardOrder = serialiseStringArray(updates.cardIds);
  }
  if (!setClauses.length) {
    return parseDeck(current);
  }
  setClauses.push('updated_at = @updatedAt');
  const sql = `UPDATE flashcard_deck SET ${setClauses.join(', ')} WHERE id = @deckId`;
  db.prepare(sql).run(params);
  return parseDeck(ensureDeckExists(deckId));
}

export function deleteDeck(deckId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM flashcard_deck WHERE id = ?').run(deckId);
}

export function listDecks(): Deck[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM flashcard_deck ORDER BY LOWER(title) ASC, created_at ASC')
    .all() as DeckRow[];
  return rows.map(parseDeck);
}

export function getDeck(deckId: string): Deck {
  return parseDeck(ensureDeckExists(deckId));
}

export function createCard(input: CreateCardInput): Card {
  const db = getDb();
  ensureDeckExists(input.deckId);
  const id = generateId('card');
  const now = nowIso();
  const tags = serialiseStringArray(normaliseTags(input.tags, DEFAULT_CARD_TAGS));
  const sourceIds = serialiseStringArray(parseStringArray(input.sourceIds ?? []));

  const insert = db.prepare(
    `INSERT INTO flashcard_card (id, deck_id, front, back, tags, source_ids, created_at, updated_at)
     VALUES (@id, @deckId, @front, @back, @tags, @sourceIds, @createdAt, @updatedAt)`
  );

  const transaction = db.transaction(() => {
    insert.run({
      id,
      deckId: input.deckId,
      front: input.front.trim(),
      back: input.back.trim(),
      tags,
      sourceIds,
      createdAt: now,
      updatedAt: now
    });
    const deckRow = ensureDeckExists(input.deckId);
    const order = parseStringArray(deckRow.card_order);
    const nextOrder = insertIntoOrder(order, [id], 'end');
    updateDeckOrder(deckRow.id, nextOrder);
  });

  transaction();
  return parseCard(ensureCardExists(id));
}

export function updateCard(cardId: string, updates: UpdateCardInput): Card {
  const db = getDb();
  const current = ensureCardExists(cardId);
  const now = nowIso();
  const setClauses: string[] = [];
  const params: Record<string, unknown> = { cardId, updatedAt: now };

  if (updates.front !== undefined) {
    setClauses.push('front = @front');
    params.front = updates.front.trim();
  }
  if (updates.back !== undefined) {
    setClauses.push('back = @back');
    params.back = updates.back.trim();
  }
  if (updates.tags !== undefined) {
    setClauses.push('tags = @tags');
    params.tags = serialiseStringArray(normaliseTags(updates.tags, DEFAULT_CARD_TAGS));
  }
  if (updates.sourceIds !== undefined) {
    setClauses.push('source_ids = @sourceIds');
    params.sourceIds = serialiseStringArray(parseStringArray(updates.sourceIds));
  }
  if (updates.studiedCount !== undefined) {
    setClauses.push('studied_count = @studiedCount');
    params.studiedCount = Math.max(0, Math.floor(updates.studiedCount));
  }
  if (updates.lastStudiedAt !== undefined) {
    setClauses.push('last_studied_at = @lastStudiedAt');
    params.lastStudiedAt = updates.lastStudiedAt;
  }
  if (!setClauses.length) {
    return parseCard(current);
  }
  setClauses.push('updated_at = @updatedAt');
  const sql = `UPDATE flashcard_card SET ${setClauses.join(', ')} WHERE id = @cardId`;
  db.prepare(sql).run(params);
  return parseCard(ensureCardExists(cardId));
}

export function deleteCard(cardId: string): void {
  const db = getDb();
  const current = ensureCardExists(cardId);
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM flashcard_card WHERE id = ?').run(cardId);
    const deckRow = ensureDeckExists(current.deck_id);
    const order = parseStringArray(deckRow.card_order);
    const nextOrder = removeFromOrder(order, [cardId]);
    updateDeckOrder(deckRow.id, nextOrder);
  });
  transaction();
}

function sortCards(cards: Card[], sort: CardSortOrder | undefined): Card[] {
  if (!sort || sort === 'recent') {
    return [...cards].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }
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
  return [...cards];
}

export function listCardsByDeck(deckId: string, options: ListCardsOptions = {}): Card[] {
  const db = getDb();
  ensureDeckExists(deckId);
  const rows = (db.prepare('SELECT * FROM flashcard_card WHERE deck_id = ?').all(deckId) as CardRow[]).map(
    parseCard
  );
  if (!options.sort || options.sort === 'recent' || options.sort === 'alphabetical' || options.sort === 'studied') {
    return sortCards(rows, options.sort);
  }
  return rows;
}

export function moveCards(request: MoveCardsRequest): Deck {
  const { cardIds, targetDeckId, position } = request;
  if (!cardIds.length) {
    return getDeck(targetDeckId);
  }
  const db = getDb();
  const transaction = db.transaction(() => {
    const targetDeckRow = ensureDeckExists(targetDeckId);
    const targetOrder = parseStringArray(targetDeckRow.card_order);
    const movedIds: string[] = [];

    for (const cardId of cardIds) {
      const cardRow = ensureCardExists(cardId);
      if (cardRow.deck_id === targetDeckId) {
        movedIds.push(cardId);
        continue;
      }
      const sourceDeckRow = ensureDeckExists(cardRow.deck_id);
      const sourceOrder = parseStringArray(sourceDeckRow.card_order);
      const nextSourceOrder = removeFromOrder(sourceOrder, [cardId]);
      updateDeckOrder(sourceDeckRow.id, nextSourceOrder);
      db.prepare('UPDATE flashcard_card SET deck_id = ?, updated_at = ? WHERE id = ?').run(
        targetDeckId,
        nowIso(),
        cardId
      );
      movedIds.push(cardId);
    }
    const updatedOrder = insertIntoOrder(targetOrder, movedIds, position);
    updateDeckOrder(targetDeckId, updatedOrder);
  });
  transaction();
  return getDeck(targetDeckId);
}

export function mergeDecks(request: MergeDecksRequest): Deck {
  const { sourceDeckId, targetDeckId } = request;
  if (sourceDeckId === targetDeckId) {
    return getDeck(targetDeckId);
  }
  const db = getDb();
  const transaction = db.transaction(() => {
    const sourceDeckRow = ensureDeckExists(sourceDeckId);
    const targetDeckRow = ensureDeckExists(targetDeckId);

    const targetCards = (
      db.prepare('SELECT * FROM flashcard_card WHERE deck_id = ?').all(targetDeckId) as CardRow[]
    ).map(parseCard);
    const seen = new Map<string, string>();
    targetCards.forEach((card) => {
      const key = card.front.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, card.id);
      }
    });

    const sourceCards = db.prepare('SELECT * FROM flashcard_card WHERE deck_id = ?').all(sourceDeckId) as CardRow[];
    const transferable: string[] = [];

    sourceCards.forEach((row) => {
      const key = row.front.trim().toLowerCase();
      if (seen.has(key)) {
        // duplicate, skip so cascade delete removes it when deck is deleted
        return;
      }
      seen.set(key, row.id);
      transferable.push(row.id);
      db.prepare('UPDATE flashcard_card SET deck_id = ?, updated_at = ? WHERE id = ?').run(
        targetDeckId,
        nowIso(),
        row.id
      );
    });

    const targetOrder = parseStringArray(targetDeckRow.card_order);
    const mergedOrder = insertIntoOrder(targetOrder, transferable, 'end');
    updateDeckOrder(targetDeckId, mergedOrder);

    db.prepare('DELETE FROM flashcard_deck WHERE id = ?').run(sourceDeckId);
  });
  transaction();
  return getDeck(targetDeckId);
}

export function searchCards(query: string): SearchCardsResult[] {
  const db = getDb();
  const pattern = `%${query.trim().toLowerCase()}%`;
  const rows = db
    .prepare<
      CardRow & { deck_title: string; deck_scope: 'class' | 'general'; deck_tags: string; deck_class_id: string | null; deck_created_at: string; deck_updated_at: string; deck_card_order: string }
    >(
      `SELECT c.*, d.title AS deck_title, d.scope AS deck_scope, d.tags AS deck_tags, d.class_id AS deck_class_id, d.created_at AS deck_created_at, d.updated_at AS deck_updated_at, d.card_order AS deck_card_order
       FROM flashcard_card c
       JOIN flashcard_deck d ON c.deck_id = d.id
       WHERE LOWER(c.front) LIKE ? OR LOWER(c.back) LIKE ? OR LOWER(c.tags) LIKE ? OR LOWER(d.title) LIKE ?
       ORDER BY d.title COLLATE NOCASE ASC, c.front COLLATE NOCASE ASC`
    )
    .all(pattern, pattern, pattern, pattern);

  return rows.map((row) => ({
    card: parseCard(row),
    deck: {
      id: row.deck_id,
      title: row.deck_title,
      scope: row.deck_scope,
      tags: parseStringArray(row.deck_tags, DEFAULT_DECK_TAGS),
      classId: row.deck_class_id ?? undefined,
      createdAt: row.deck_created_at,
      updatedAt: row.deck_updated_at,
      cardIds: parseStringArray(row.deck_card_order)
    }
  }));
}

export function saveSourceAsset(input: SaveSourceAssetInput): SourceAsset {
  const db = getDb();
  const id = input.id ?? generateId('src');
  const createdAt = input.createdAt ?? nowIso();
  const type = input.type ?? DEFAULT_SOURCE_TYPE;
  db.prepare(
    `INSERT INTO flashcard_source_asset (id, type, filename, mime_type, text_extract, created_at)
     VALUES (@id, @type, @filename, @mimeType, @textExtract, @createdAt)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       filename = excluded.filename,
       mime_type = excluded.mimeType,
       text_extract = excluded.text_extract,
       created_at = excluded.created_at`
  ).run({
    id,
    type,
    filename: input.filename ?? null,
    mimeType: input.mimeType ?? null,
    textExtract: input.textExtract,
    createdAt
  });
  return getSourceAsset(id);
}

export function getSourceAsset(id: string): SourceAsset {
  const db = getDb();
  const row = db.prepare<SourceRow>('SELECT * FROM flashcard_source_asset WHERE id = ?').get(id);
  if (!row) {
    throw new Error(`Source asset ${id} not found`);
  }
  return parseSource(row);
}

function ensureQuotaRow(userId: string): QuotaRow {
  const db = getDb();
  const existing = db.prepare<QuotaRow>('SELECT * FROM flashcard_quota WHERE user_id = ?').get(userId);
  if (existing) {
    return existing;
  }
  db.prepare(
    `INSERT INTO flashcard_quota (user_id, used, quota_limit, reset_at) VALUES (?, ?, ?, ?)`
  ).run(userId, 0, DEFAULT_QUOTA_LIMIT, null);
  return {
    user_id: userId,
    used: 0,
    quota_limit: DEFAULT_QUOTA_LIMIT,
    reset_at: null
  };
}

function toQuotaInfo(row: QuotaRow): FlashcardQuotaInfo {
  const remaining = Math.max(0, row.quota_limit - row.used);
  return {
    userId: row.user_id,
    used: row.used,
    limit: row.quota_limit,
    resetAt: row.reset_at,
    remaining,
    allowed: remaining > 0
  };
}

export function checkFlashcardQuota(userId: string): FlashcardQuotaInfo {
  const row = ensureQuotaRow(userId);
  return toQuotaInfo(row);
}

export function incrementFlashcardQuotaUsage(request: IncrementQuotaRequest): FlashcardQuotaInfo {
  const { userId, amount } = request;
  const db = getDb();
  if (!Number.isFinite(amount) || amount <= 0) {
    return checkFlashcardQuota(userId);
  }
  const transaction = db.transaction(() => {
    const current = ensureQuotaRow(userId);
    const nextUsed = current.used + Math.max(0, Math.floor(amount));
    db.prepare('UPDATE flashcard_quota SET used = ?, quota_limit = quota_limit WHERE user_id = ?').run(
      nextUsed,
      userId
    );
  });
  transaction();
  return checkFlashcardQuota(userId);
}

export function setFlashcardQuotaLimit(userId: string, limit: number): FlashcardQuotaInfo {
  const db = getDb();
  const value = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_QUOTA_LIMIT;
  const transaction = db.transaction(() => {
    ensureQuotaRow(userId);
    db.prepare('UPDATE flashcard_quota SET quota_limit = ? WHERE user_id = ?').run(value, userId);
  });
  transaction();
  return checkFlashcardQuota(userId);
}
