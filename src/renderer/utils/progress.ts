// src/renderer/utils/progress.ts
export function calculateProgressPercent(completed: number, total: number) {
  if (!total || total <= 0) return 0;
  const pct = Math.round((completed / total) * 100);
  return Math.min(100, Math.max(0, pct));
}