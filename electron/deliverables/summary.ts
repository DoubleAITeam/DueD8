import type {
  ArtifactKind,
  DeliverableJobResult,
  DeliverableRunRecord,
  RunSummary
} from './types';

const KNOWN_KINDS: ArtifactKind[] = ['pdf', 'docx', 'html'];

function coerceNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '0 seconds';
  }
  const seconds = durationMs / 1000;
  const precise = seconds >= 10 ? Math.round(seconds) : Number(seconds.toFixed(1));
  const unit = precise === 1 ? 'second' : 'seconds';
  return `${precise} ${unit}`;
}

function pluralize(value: number, singular: string, plural?: string): string {
  const label = value === 1 ? singular : plural ?? `${singular}s`;
  return `${value} ${label}`;
}

function toArtifactKind(value: unknown): ArtifactKind | null {
  if (typeof value !== 'string') {
    return null;
  }
  return (KNOWN_KINDS as string[]).includes(value) ? (value as ArtifactKind) : null;
}

function normaliseResult(result: DeliverableJobResult): DeliverableJobResult {
  if (result && typeof result === 'object') {
    return result;
  }
  return {
    id: 'unknown-artifact',
    success: false,
    message: 'Invalid result payload received.'
  };
}

export function buildRunSummary(run: DeliverableRunRecord): RunSummary {
  const runId = typeof run?.runId === 'string' ? run.runId : 'unknown-run';
  const startedAt = coerceNumber(run?.startedAt);
  const finishedAt = coerceNumber(run?.finishedAt);
  const durationMs = Math.max(0, finishedAt - startedAt);
  const results = Array.isArray(run?.results) ? run.results.map(normaliseResult) : [];

  const totals = {
    count: results.length,
    ok: 0,
    failed: 0,
    cancelled: 0,
    skipped: 0
  };

  const byType: Record<ArtifactKind, { count: number; ok: number; failed: number }> = {
    pdf: { count: 0, ok: 0, failed: 0 },
    docx: { count: 0, ok: 0, failed: 0 },
    html: { count: 0, ok: 0, failed: 0 }
  };

  const adaptersUsed: Record<string, number> = {};
  const typeAdapterUsage: Record<ArtifactKind, Record<string, number>> = {
    pdf: {},
    docx: {},
    html: {}
  };

  const errorCounts = new Map<string, number>();
  let fallbackCount = 0;

  for (const raw of results) {
    const result = normaliseResult(raw);
    const type = toArtifactKind((result as { type?: ArtifactKind }).type);

    if (type) {
      byType[type].count += 1;
    }

    const badge = result.badge;
    if (badge === 'cancelled') {
      totals.cancelled += 1;
    } else if (badge === 'skipped') {
      totals.skipped += 1;
    } else if (result.success) {
      totals.ok += 1;
      if (type) {
        byType[type].ok += 1;
      }
    } else {
      totals.failed += 1;
      if (type) {
        byType[type].failed += 1;
      }
    }

    const adapterId = typeof result.adapterId === 'string' && result.adapterId.length > 0
      ? result.adapterId
      : null;
    if (adapterId) {
      adaptersUsed[adapterId] = (adaptersUsed[adapterId] ?? 0) + 1;
      if (type) {
        const usage = typeAdapterUsage[type];
        usage[adapterId] = (usage[adapterId] ?? 0) + 1;
      }
    }

    const attempted = Array.isArray(result.attempted) ? result.attempted : [];
    const fallbackInMessage = typeof result.adapterReason === 'string'
      ? result.adapterReason.toLowerCase().includes('fallback')
      : false;
    if (attempted.filter((id) => typeof id === 'string').length > 1 || fallbackInMessage) {
      fallbackCount += 1;
    }

    const errors = Array.isArray(result.errors) ? result.errors : [];
    for (const error of errors) {
      const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN_ERROR';
      errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
    }
  }

  const durationText = formatDuration(durationMs);
  const processedCount = totals.count - totals.cancelled;
  const failureCount = totals.failed;

  let headline: string;
  if (totals.count === 0) {
    headline = 'No artifacts were processed.';
  } else if (totals.cancelled > 0 && failureCount === 0) {
    headline = `Run cancelled after processing ${processedCount} of ${totals.count} artifacts`;
  } else if (failureCount === 0) {
    headline = `Processed ${totals.count} artifacts in ${durationText} with 0 failures`;
  } else {
    headline = `${totals.count} artifacts in ${durationText} with ${failureCount} failures and ${fallbackCount} fallbacks`;
  }

  const bullets: string[] = [];
  bullets.push(
    `Totals: ${totals.ok} ok, ${totals.failed} failed, ${totals.cancelled} cancelled, ${totals.skipped} skipped.`
  );

  for (const kind of KNOWN_KINDS) {
    const entry = byType[kind];
    if (entry.count === 0) {
      continue;
    }
    const usageEntries = Object.entries(typeAdapterUsage[kind]).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const adapterSummary =
      usageEntries.length > 0
        ? `adapters used ${usageEntries
            .map(([adapter, count]) => `${adapter}: ${count}`)
            .join(', ')}`
        : 'no adapters recorded';
    bullets.push(`${kind.toUpperCase()}: ${entry.ok} ok, ${entry.failed} failed, ${adapterSummary}.`);
  }

  if (fallbackCount > 0) {
    bullets.push(`Fallback adapters triggered ${pluralize(fallbackCount, 'time')}.`);
  } else {
    bullets.push('No fallback adapters were required.');
  }

  const errorEntries = Array.from(errorCounts.entries()).sort((a, b) => {
    if (b[1] === a[1]) {
      return a[0].localeCompare(b[0]);
    }
    return b[1] - a[1];
  });
  if (errorEntries.length > 0) {
    bullets.push(`Top errors: ${errorEntries.map(([code, count]) => `${code} ${count}`).join(', ')}.`);
  } else {
    bullets.push('Top errors: none recorded.');
  }

  if (bullets.length < 3) {
    const adapterEntries = Object.entries(adaptersUsed).sort(([a], [b]) => a.localeCompare(b));
    const adapterBullet =
      adapterEntries.length > 0
        ? `Adapters used overall: ${adapterEntries
            .map(([adapter, count]) => `${adapter}: ${count}`)
            .join(', ')}.`
        : 'Adapters used overall: none recorded.';
    bullets.push(adapterBullet);
  }

  while (bullets.length > 6) {
    bullets.pop();
  }

  const summary: RunSummary = {
    runId,
    startedAt,
    finishedAt,
    totals,
    byType,
    adaptersUsed,
    fallbackCount,
    durationMs,
    headline,
    bullets
  };

  return summary;
}
