/**
 * Describes the dashboard grid arrangement for regression checks.
 * @returns {{ rows: string[][] }}
 */
export function expectedDashboardLayout() {
  return {
    rows: [
      ['hero', 'quick-actions'],
      ['progress', 'schedule'],
      ['recent', 'recent']
    ]
  };
}
