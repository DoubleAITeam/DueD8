const assert = require('assert');
const { calculateProgressPercent } = require('../src/renderer/utils/progress.node.cjs');

function testProgressPercent(fn) {
  assert.strictEqual(fn(5, 10), 50, 'halfway should be 50%');
  assert.strictEqual(fn(0, 10), 0, 'zero completed should be 0%');
  assert.strictEqual(fn(12, 10), 100, 'progress should clamp at 100%');
  assert.strictEqual(fn(3, 0), 0, 'invalid totals should produce 0%');
}

function testDeadlineFilter(filterDeadlinesByDate) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const deadlines = [
    { id: '1', title: 'One', course: 'Course', dueAtIso: today.toISOString() },
    { id: '2', title: 'Two', course: 'Course', dueAtIso: tomorrow.toISOString() }
  ];
  const filteredToday = filterDeadlinesByDate(deadlines, today);
  assert.strictEqual(filteredToday.length, 1, 'should match exactly one deadline');
  assert.strictEqual(filteredToday[0].id, '1');
  const filteredTomorrow = filterDeadlinesByDate(deadlines, tomorrow);
  assert.strictEqual(filteredTomorrow.length, 1, 'should match tomorrow deadline');
  assert.strictEqual(filteredTomorrow[0].id, '2');
}

function testDashboardLayout(getLayoutSpec) {
  const spec = getLayoutSpec();
  const expected = [
    ['hero', 'quick-actions'],
    ['progress', 'schedule'],
    ['recent', 'recent']
  ];
  assert.deepStrictEqual(spec.rows, expected, 'dashboard layout rows should remain consistent');
}

async function run() {
  const { filterDeadlinesByDate } = await import('../src/renderer/utils/deadlines.node.cjs');
  const { expectedDashboardLayout } = await import('../src/renderer/utils/dashboardLayout.node.cjs');
  testProgressPercent(calculateProgressPercent);
  testDeadlineFilter(filterDeadlinesByDate);
  testDashboardLayout(expectedDashboardLayout);
  console.log('All tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
