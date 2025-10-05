import type { ArtifactKind } from '../types';
import type { AdapterHealth, RendererAdapter } from './adapter';

const CACHE_TTL_MS = 60_000;
const SAFE_COPY_PREFIX = 'copy-';

const PREFERRED_BY_KIND: Partial<Record<ArtifactKind, string>> = {
  html: 'puppeteer-html',
  docx: 'libreoffice-docx',
  pdf: 'qpdf-pdf'
};

const FALLBACK_BY_KIND: Partial<Record<ArtifactKind, string>> = {
  html: 'static-html',
  docx: 'copy-docx',
  pdf: 'copy-pdf'
};

type CachedHealth = { value: AdapterHealth; timestamp: number };

const adapters: RendererAdapter[] = [];
const healthCache = new Map<string, CachedHealth>();

function isSafeCopyAdapter(adapter: RendererAdapter): boolean {
  return adapter.id.startsWith(SAFE_COPY_PREFIX);
}

function pruneCache(adapterId: string): void {
  const cached = healthCache.get(adapterId);
  if (!cached) {
    return;
  }
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    healthCache.delete(adapterId);
  }
}

async function readHealth(adapter: RendererAdapter): Promise<AdapterHealth> {
  pruneCache(adapter.id);
  const cached = healthCache.get(adapter.id);
  if (cached) {
    return cached.value;
  }

  let health: AdapterHealth;
  try {
    health = await adapter.health();
  } catch (error) {
    health = {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Adapter health check failed.'
    };
  }

  healthCache.set(adapter.id, { value: health, timestamp: Date.now() });
  return health;
}

function findAdapterById(candidates: RendererAdapter[], id?: string | null): RendererAdapter | undefined {
  if (!id) {
    return undefined;
  }
  return candidates.find((adapter) => adapter.id === id);
}

function resolveFallbackCandidate(
  candidates: RendererAdapter[],
  preferred?: RendererAdapter,
  explicitFallback?: RendererAdapter
): RendererAdapter | undefined {
  if (explicitFallback) {
    return explicitFallback;
  }
  const safeCopy = candidates.find((adapter) => isSafeCopyAdapter(adapter) && adapter.id !== preferred?.id);
  return safeCopy ?? preferred;
}

export interface AdapterSelection {
  adapter: RendererAdapter;
  health: AdapterHealth;
  usedFallback: boolean;
  reason: string;
  preferredId?: string | null;
  preferredHealth?: AdapterHealth | null;
  fallbackId?: string | null;
  fallbackHealth?: AdapterHealth | null;
  fallbackAdapter?: RendererAdapter | null;
}

async function selectAdapter(kind: ArtifactKind): Promise<AdapterSelection> {
  const candidates = adapters.filter((adapter) => adapter.handles.includes(kind));
  if (candidates.length === 0) {
    throw new Error(`No registered renderer adapters for kind: ${kind}`);
  }

  const preferredId = PREFERRED_BY_KIND[kind];
  const fallbackId = FALLBACK_BY_KIND[kind];

  const preferredAdapter = findAdapterById(candidates, preferredId);
  const explicitFallback = findAdapterById(candidates, fallbackId);
  const fallbackAdapterCandidate = resolveFallbackCandidate(candidates, preferredAdapter, explicitFallback);

  const evaluatedHealth = new Map<string, AdapterHealth>();
  async function ensureHealth(adapter: RendererAdapter): Promise<AdapterHealth> {
    const cached = evaluatedHealth.get(adapter.id);
    if (cached) {
      return cached;
    }
    const value = await readHealth(adapter);
    evaluatedHealth.set(adapter.id, value);
    return value;
  }

  let preferredHealth: AdapterHealth | null = null;
  if (preferredAdapter) {
    preferredHealth = await ensureHealth(preferredAdapter);
    if (preferredHealth.ok) {
      const fallbackHealth = fallbackAdapterCandidate
        ? await ensureHealth(fallbackAdapterCandidate)
        : null;
      return {
        adapter: preferredAdapter,
        health: preferredHealth,
        usedFallback: false,
        reason: 'Preferred adapter healthy.',
        preferredId: preferredAdapter.id,
        preferredHealth,
        fallbackId: fallbackAdapterCandidate?.id ?? null,
        fallbackHealth,
        fallbackAdapter: fallbackAdapterCandidate ?? null
      };
    }
  } else if (preferredId) {
    preferredHealth = {
      ok: false,
      message: 'Preferred adapter not registered.'
    };
  }

  let fallbackHealth: AdapterHealth | null = null;
  if (fallbackAdapterCandidate) {
    fallbackHealth = await ensureHealth(fallbackAdapterCandidate);
  }

  const alternativeCandidates = candidates.filter((adapter) => {
    if (preferredAdapter && adapter.id === preferredAdapter.id) {
      return false;
    }
    if (fallbackAdapterCandidate && adapter.id === fallbackAdapterCandidate.id) {
      return false;
    }
    return !isSafeCopyAdapter(adapter);
  });

  for (const candidate of alternativeCandidates) {
    const health = await ensureHealth(candidate);
    if (health.ok) {
      const reasonParts: string[] = [];
      if (preferredAdapter) {
        const detail = preferredHealth?.message ? ` (${preferredHealth.message})` : '';
        reasonParts.push(`Preferred adapter ${preferredAdapter.id} unavailable${detail}.`);
      } else if (preferredId) {
        const detail = preferredHealth?.message ? ` (${preferredHealth.message})` : '';
        reasonParts.push(`Preferred adapter ${preferredId} unavailable${detail}.`);
      }
      reasonParts.push(`Using alternative adapter ${candidate.id}.`);

      return {
        adapter: candidate,
        health,
        usedFallback: false,
        reason: reasonParts.join(' ').trim() || 'Healthy adapter selected.',
        preferredId: preferredAdapter?.id ?? preferredId ?? null,
        preferredHealth,
        fallbackId: fallbackAdapterCandidate?.id ?? null,
        fallbackHealth,
        fallbackAdapter: fallbackAdapterCandidate ?? null
      };
    }
  }

  const fallbackAdapter = fallbackAdapterCandidate ?? preferredAdapter ?? candidates[0];
  const fallbackAdapterHealth = fallbackAdapterCandidate
    ? fallbackAdapterCandidate === fallbackAdapter
      ? fallbackHealth ?? (await ensureHealth(fallbackAdapter))
      : await ensureHealth(fallbackAdapter)
    : await ensureHealth(fallbackAdapter);

  const usedFallback = Boolean(preferredAdapter && fallbackAdapter.id !== preferredAdapter.id);
  const reasonParts: string[] = [];
  if (preferredAdapter) {
    const detail = preferredHealth?.message ? ` (${preferredHealth.message})` : '';
    reasonParts.push(`Preferred adapter ${preferredAdapter.id} unavailable${detail}.`);
  } else if (preferredId) {
    const detail = preferredHealth?.message ? ` (${preferredHealth.message})` : '';
    reasonParts.push(`Preferred adapter ${preferredId} unavailable${detail}.`);
  }

  if (fallbackAdapterCandidate) {
    if (fallbackAdapterCandidate.id === fallbackAdapter.id) {
      const detail = fallbackAdapterHealth?.message ? ` (${fallbackAdapterHealth.message})` : '';
      const descriptor = fallbackAdapterHealth?.ok
        ? `Using fallback ${fallbackAdapter.id}.`
        : `Fallback adapter ${fallbackAdapter.id} unhealthy${detail}.`;
      reasonParts.push(descriptor);
    } else {
      reasonParts.push(`Using adapter ${fallbackAdapter.id}.`);
    }
  } else {
    reasonParts.push(`Using adapter ${fallbackAdapter.id}.`);
  }

  const reason = reasonParts.join(' ').trim() || 'Using available adapter.';

  return {
    adapter: fallbackAdapter,
    health: fallbackAdapterHealth,
    usedFallback,
    reason,
    preferredId: preferredAdapter?.id ?? preferredId ?? null,
    preferredHealth,
    fallbackId: fallbackAdapterCandidate?.id ?? fallbackAdapter.id ?? null,
    fallbackHealth: fallbackAdapterCandidate ? fallbackHealth ?? fallbackAdapterHealth : fallbackAdapterHealth,
    fallbackAdapter: fallbackAdapterCandidate ?? fallbackAdapter
  };
}
export function register(adapter: RendererAdapter): void {
  const existingIndex = adapters.findIndex((entry) => entry.id === adapter.id);
  if (existingIndex >= 0) {
    adapters.splice(existingIndex, 1);
  }
  adapters.unshift(adapter);
  healthCache.delete(adapter.id);
}

export async function getAdapterSelection(kind: ArtifactKind): Promise<AdapterSelection> {
  return selectAdapter(kind);
}

export async function getBestAdapter(kind: ArtifactKind): Promise<RendererAdapter> {
  const selection = await selectAdapter(kind);
  return selection.adapter;
}

export interface AdapterOverviewEntry {
  selectedAdapterId: string;
  selectedHealth: AdapterHealth;
  preferredAdapterId: string | null;
  preferredHealth: AdapterHealth | null;
  fallbackAdapterId: string | null;
  fallbackHealth: AdapterHealth | null;
  usingFallback: boolean;
  reason: string;
}

export async function getAdapterOverview(): Promise<Record<ArtifactKind, AdapterOverviewEntry>> {
  const overview: Partial<Record<ArtifactKind, AdapterOverviewEntry>> = {};
  const kinds: ArtifactKind[] = ['pdf', 'docx', 'html'];
  await Promise.all(
    kinds.map(async (kind) => {
      try {
        const selection = await selectAdapter(kind);
        overview[kind] = {
          selectedAdapterId: selection.adapter.id,
          selectedHealth: selection.health,
          preferredAdapterId: selection.preferredId ?? null,
          preferredHealth: selection.preferredHealth ?? null,
          fallbackAdapterId: selection.fallbackId ?? null,
          fallbackHealth: selection.fallbackHealth ?? null,
          usingFallback: selection.usedFallback,
          reason: selection.reason
        };
      } catch (error) {
        overview[kind] = {
          selectedAdapterId: 'unavailable',
          selectedHealth: {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : 'No adapters registered.'
          },
          preferredAdapterId: null,
          preferredHealth: null,
          fallbackAdapterId: null,
          fallbackHealth: null,
          usingFallback: true,
          reason: 'No adapters registered.'
        };
      }
    })
  );
  return overview as Record<ArtifactKind, AdapterOverviewEntry>;
}

export function __resetRegistryForTests(): void {
  adapters.splice(0, adapters.length);
  healthCache.clear();
}

export async function refreshAdapterHealth(adapterId?: string): Promise<void> {
  if (adapterId) {
    const adapter = adapters.find((entry) => entry.id === adapterId);
    if (!adapter) {
      return;
    }
    healthCache.delete(adapterId);
    await readHealth(adapter);
    return;
  }

  await Promise.all(
    adapters.map((adapter) => {
      healthCache.delete(adapter.id);
      return readHealth(adapter);
    })
  );
}

export { selectAdapter as __selectAdapterForTests };
