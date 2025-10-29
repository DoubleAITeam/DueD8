const FALLBACK_PRO_FEATURES = [
  'Longer token limits',
  'Priority queue',
  'Multi-file renders',
  'Export to PDF/Docx',
  'Audit history'
];

const CACHE_TTL = 5 * 60 * 1000;

let cached: { features: string[]; expiresAt: number } | null = null;

function ensureArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
    .slice(0, 5);
}

export async function getProFeatures(): Promise<string[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.features;
  }

  try {
    const result = await window.dued8.budget.getProFeatures();
    const features = ensureArray(result);
    if (features.length) {
      cached = { features, expiresAt: now + CACHE_TTL };
      return features;
    }
  } catch (error) {
    console.error('[pro] Failed to load PRO feature copy', error);
  }

  cached = { features: FALLBACK_PRO_FEATURES, expiresAt: now + CACHE_TTL };
  return FALLBACK_PRO_FEATURES;
}

export { FALLBACK_PRO_FEATURES };
