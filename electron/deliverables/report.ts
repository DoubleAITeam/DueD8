import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtifactKind, DeliverableRunRecord, RunSummary } from './types';

const BADGE_CLASS_MAP: Record<string, string> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  cancelled: 'cancelled',
  skipped: 'skipped'
};

function resolveReportsDir(): string {
  return path.join(app.getPath('userData'), 'deliverables', 'reports');
}

function escapeHtml(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toTypeLabel(result: unknown): string {
  const type = (result as { type?: ArtifactKind | string })?.type;
  return typeof type === 'string' && type.length > 0 ? type : 'unknown';
}

function renderBadge(badge: unknown): string {
  if (typeof badge !== 'string' || badge.length === 0) {
    return '<span class="status-badge">unknown</span>';
  }
  const className = BADGE_CLASS_MAP[badge] ?? 'unknown';
  return `<span class="status-badge ${className}">${escapeHtml(badge)}</span>`;
}

function buildHtmlReport(run: DeliverableRunRecord, summary: RunSummary): string {
  const started = new Date(summary.startedAt).toISOString();
  const finished = new Date(summary.finishedAt).toISOString();
  const styles = `
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7f7; color: #202124; margin: 0; padding: 24px; }
    h1, h2, h3 { margin-top: 0; }
    header { margin-bottom: 24px; }
    .panel { background: #ffffff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 24px; }
    .headline { font-size: 1.1rem; font-weight: 600; margin-bottom: 12px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .chip { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; background: #eef2f7; color: #1f2933; font-size: 0.85rem; }
    .chip strong { margin-right: 4px; }
    ul.summary-bullets { padding-left: 20px; margin: 0; }
    ul.summary-bullets li { margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #dfe3e8; padding: 8px; text-align: left; vertical-align: top; font-size: 0.9rem; }
    th { background: #f1f3f6; font-weight: 600; }
    .status-badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
    .status-badge.success { background: #e6f4ea; color: #0b8043; }
    .status-badge.warning { background: #fff4e5; color: #c25e00; }
    .status-badge.error { background: #fdecea; color: #c5221f; }
    .status-badge.cancelled { background: #f1f3f4; color: #5f6368; }
    .status-badge.skipped { background: #e8f0fe; color: #1967d2; }
    .status-badge.unknown { background: #eceff1; color: #37474f; }
    .table-wrapper { overflow-x: auto; }
    footer { margin-top: 32px; font-size: 0.8rem; color: #5f6368; }
  `;

  const totalsChips = [
    `<span class="chip"><strong>Total</strong>${summary.totals.count}</span>`,
    `<span class="chip"><strong>Success</strong>${summary.totals.ok}</span>`,
    `<span class="chip"><strong>Failed</strong>${summary.totals.failed}</span>`,
    `<span class="chip"><strong>Cancelled</strong>${summary.totals.cancelled}</span>`,
    `<span class="chip"><strong>Skipped</strong>${summary.totals.skipped}</span>`
  ];

  for (const [kind, stats] of Object.entries(summary.byType)) {
    totalsChips.push(
      `<span class="chip"><strong>${kind.toUpperCase()}</strong>${stats.ok}/${stats.count}</span>`
    );
  }

  const bulletItems = summary.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('');

  const rows = Array.isArray(run.results)
    ? run.results
        .map((result) => {
          const type = toTypeLabel(result);
          const badge = renderBadge(result?.badge ?? (result?.success ? 'success' : 'error'));
          const attempts = typeof result?.attempts === 'number' ? String(result.attempts) : '—';
          const attempted = Array.isArray(result?.attempted) && result.attempted.length > 0
            ? escapeHtml(result.attempted.join(' → '))
            : '—';
          const adapter = result?.adapterId ? escapeHtml(result.adapterId) : '—';
          const outputPath = result?.outputPath ? escapeHtml(result.outputPath) : '—';
          const message = result?.message ? escapeHtml(result.message) : '—';
          return `<tr>
            <td>${escapeHtml(result?.id ?? '')}</td>
            <td>${escapeHtml(type)}</td>
            <td>${badge}</td>
            <td>${adapter}</td>
            <td>${escapeHtml(attempts)}</td>
            <td>${attempted}</td>
            <td>${outputPath}</td>
            <td>${message}</td>
          </tr>`;
        })
        .join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Deliverables report – ${escapeHtml(summary.runId)}</title>
  <style>${styles}</style>
</head>
<body>
  <header>
    <h1>Deliverables Run ${escapeHtml(summary.runId)}</h1>
    <div>Started: ${escapeHtml(started)}</div>
    <div>Finished: ${escapeHtml(finished)}</div>
    <div>Duration: ${summary.durationMs} ms</div>
  </header>
  <section class="panel">
    <div class="headline">${escapeHtml(summary.headline)}</div>
    <div class="chips">${totalsChips.join('')}</div>
    <ul class="summary-bullets">${bulletItems}</ul>
  </section>
  <section class="panel">
    <h2>Results</h2>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Badge</th>
            <th>Adapter</th>
            <th>Attempts</th>
            <th>Attempted</th>
            <th>Output</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </section>
  <footer>Report generated locally. Share this file directly to review run details.</footer>
</body>
</html>`;
}

export async function writeRunReport(
  run: DeliverableRunRecord,
  summary: RunSummary,
  opts?: { format?: 'html' | 'json' }
): Promise<string> {
  try {
    const format = opts?.format === 'json' ? 'json' : 'html';
    const reportsDir = resolveReportsDir();
    await fs.mkdir(reportsDir, { recursive: true });

    const extension = format === 'json' ? 'json' : 'html';
    const targetPath = path.join(reportsDir, `${summary.runId}.${extension}`);
    const tempPath = `${targetPath}.tmp`;

    if (format === 'json') {
      const payload = { run, summary };
      await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
    } else {
      const html = buildHtmlReport(run, summary);
      await fs.writeFile(tempPath, html, 'utf-8');
    }

    await fs.rename(tempPath, targetPath);
    return targetPath;
  } catch (error) {
    return '';
  }
}
