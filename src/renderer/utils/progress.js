/**
 * Calculate a progress percentage from a completed/total tuple.
 * Always clamps the result between 0 and 100.
 * @param {number} completed
 * @param {number} total
 * @returns {number}
 */
function calculateProgressPercent(completed, total) {
  const safeCompleted = Number.isFinite(completed) ? completed : 0;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  if (!safeTotal) {
    return 0;
  }
  const raw = (safeCompleted / safeTotal) * 100;
  if (!Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(raw)));
}

module.exports = {
  calculateProgressPercent
};
