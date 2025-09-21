function calculateProgressPercent(completed, total) {
  const safeCompleted = Number.isFinite(completed) ? completed : 0;
  const safeTotal = Number.isFinite(total) ? total : 0;
  if (!safeTotal || safeTotal <= 0) return 0;
  const pct = Math.round((safeCompleted / safeTotal) * 100);
  if (!Number.isFinite(pct)) {
    return 0;
  }
  return Math.min(100, Math.max(0, pct));
}

module.exports = {
  calculateProgressPercent
};
module.exports.default = module.exports;
