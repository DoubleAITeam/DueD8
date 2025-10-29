import type { RetrieveOpts, SyllabusChunk } from "./types";
import { getCourseChunks } from "./store";

const sectionBoost: Record<string, number> = {
  assignment: 2,
  reading: 1.5,
  schedule: 1.3,
  overview: 1,
  policy: 0.8,
};

const dateDecayWindowDays = 120;

export function retrieveContext(opts: RetrieveOpts) {
  const k = opts.k ?? 6;
  const today = opts.today ?? new Date();
  const normalizedQuery = opts.query.trim().toLowerCase();
  const queryTokens = tokenize(normalizedQuery);

  const chunks = getCourseChunks(opts.courseId);
  if (!chunks.length) {
    return [] as SyllabusChunk[];
  }

  const scored = chunks.map((chunk) => ({
    chunk,
    score: computeScore({ chunk, queryTokens, today }),
  }));

  scored.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) {
      return byScore;
    }

    return compareByRecencyDesc(a.chunk, b.chunk);
  });

  return scored.slice(0, k).map((item) => item.chunk);
}

function computeScore({
  chunk,
  queryTokens,
  today,
}: {
  chunk: SyllabusChunk;
  queryTokens: string[];
  today: Date;
}) {
  const sectionMultiplier = sectionBoost[chunk.section] ?? 1;
  const keywordScore = computeKeywordScore(chunk, queryTokens);
  const recencyScore = computeRecencyScore(chunk, today);
  const densityScore = chunk.tokens ? Math.min(chunk.tokens / 200, 1) * 0.1 : 0;

  const base = keywordScore + recencyScore + densityScore;
  return base * sectionMultiplier;
}

function computeKeywordScore(chunk: SyllabusChunk, tokens: string[]) {
  if (!tokens.length) {
    return 0.5; // default to recency only when no query tokens
  }

  let headingScore = 0;
  let textScore = 0;

  for (const token of tokens) {
    if (!token) continue;
    if (chunk.heading && chunk.heading.toLowerCase().includes(token)) {
      headingScore += 2;
    }

    const occurrences = countOccurrences(chunk.text, token);
    textScore += occurrences;
  }

  return headingScore + textScore;
}

function computeRecencyScore(chunk: SyllabusChunk, today: Date) {
  if (!chunk.dateISO) {
    return 0.2;
  }

  const chunkDate = new Date(chunk.dateISO);
  if (Number.isNaN(chunkDate.getTime())) {
    return 0.2;
  }

  const diffMs = Math.abs(today.getTime() - chunkDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays >= dateDecayWindowDays) {
    return 0.15;
  }

  const normalized = 1 - diffDays / dateDecayWindowDays;
  return 0.15 + normalized * 0.85;
}

function compareByRecencyDesc(a: SyllabusChunk, b: SyllabusChunk) {
  const tsA = a.dateISO ? Date.parse(a.dateISO) : NaN;
  const tsB = b.dateISO ? Date.parse(b.dateISO) : NaN;

  const aValid = !Number.isNaN(tsA);
  const bValid = !Number.isNaN(tsB);

  if (aValid && bValid) {
    if (tsA === tsB) {
      return b.text.length - a.text.length;
    }
    return tsB - tsA;
  }

  if (aValid) return -1;
  if (bValid) return 1;

  return b.text.length - a.text.length;
}

function tokenize(input: string) {
  return input
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0;
  const regex = new RegExp(escapeRegExp(needle), "gi");
  const matches = haystack.match(regex);
  return matches ? matches.length : 0;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
