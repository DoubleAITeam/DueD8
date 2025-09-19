export type AssignmentLike = {
  name?: string | null;
  description?: string | null;
};

export type AssignmentSolveability = {
  classification: 'instructions_only' | 'solvable_assignment';
  confidence: number;
  reason: string;
  signals: {
    heuristicScore: number;
    llmScore: number;
    positiveKeywords: string[];
    negativeKeywords: string[];
  };
};

function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenise(text: string) {
  return normalise(text)
    .split(' ')
    .filter((token) => token.length > 2);
}

function scoreKeywords(tokens: string[], keywords: string[]) {
  const set = new Set(tokens);
  return keywords.filter((keyword) => set.has(keyword));
}

function computeHeuristicScore(
  positiveHits: string[],
  negativeHits: string[],
  extractedLength: number
) {
  let score = positiveHits.length - negativeHits.length * 1.1;
  if (extractedLength < 120) {
    score -= 0.8;
  }
  if (positiveHits.includes('submit') || positiveHits.includes('upload')) {
    score += 0.6;
  }
  if (negativeHits.includes('syllabus')) {
    score -= 0.6;
  }
  return score;
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value));
}

export async function isActualAssignment(
  assignment: AssignmentLike | null | undefined,
  extractedText: string
): Promise<AssignmentSolveability> {
  const name = assignment?.name ?? '';
  const description = assignment?.description ?? '';
  const combined = [name, description, extractedText].filter(Boolean).join('\n');
  const normalised = normalise(combined);
  const tokens = tokenise(combined);

  const positiveKeywords = [
    'submit',
    'submission',
    'upload',
    'points',
    'rubric',
    'draft',
    'essay',
    'project',
    'problem',
    'deliverable',
    'report',
    'reflection',
    'worksheet',
    'quiz',
    'assignment',
    'deadline'
  ];
  const negativeKeywords = [
    'syllabus',
    'policies',
    'schedule',
    'calendar',
    'overview',
    'module',
    'instructor',
    'office',
    'hours',
    'grading',
    'policy',
    'textbook',
    'materials',
    'outcomes'
  ];

  const positiveHits = scoreKeywords(tokens, positiveKeywords);
  const negativeHits = scoreKeywords(tokens, negativeKeywords);

  const heuristicScore = computeHeuristicScore(positiveHits, negativeHits, normalised.length);
  const heuristicConfidence = logistic(heuristicScore / 2);

  // Lightweight zero-shot style label: compare cosine-like overlap of cue phrases.
  const zeroShotPositive = ['write', 'analyze', 'prepare', 'respond', 'research', 'design'];
  const zeroShotNegative = ['syllabus', 'welcome', 'introduction', 'policy', 'orientation'];
  const positiveZeroHits = scoreKeywords(tokens, zeroShotPositive).length;
  const negativeZeroHits = scoreKeywords(tokens, zeroShotNegative).length;
  const llmScore = (positiveZeroHits + positiveHits.length + 1) /
    (positiveZeroHits + positiveHits.length + negativeZeroHits + negativeHits.length + 2);

  const combinedConfidence = Math.min(1, Math.max(0, heuristicConfidence * 0.6 + llmScore * 0.4));
  const isAssignment = combinedConfidence >= 0.58;

  let reason = '';
  if (!positiveHits.length && negativeHits.length) {
    reason = 'Detected syllabus-style language without submission cues.';
  } else if (isAssignment) {
    reason = 'Found submission-related wording suggesting a student deliverable.';
  } else {
    reason = 'Signals were inconclusive for a student deliverable.';
  }

  return {
    classification: isAssignment ? 'solvable_assignment' : 'instructions_only',
    confidence: combinedConfidence,
    reason,
    signals: {
      heuristicScore,
      llmScore,
      positiveKeywords: positiveHits,
      negativeKeywords: negativeHits
    }
  };
}
