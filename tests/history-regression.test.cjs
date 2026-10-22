const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
function loadModule(path) {
  const result = {};
  new Function('exports', ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText)(result);
  return result;
}
const water = loadModule('src/lib/drink-history.ts');
const { summarizeReminders } = loadModule('src/lib/reminder-history.ts');

test('reminder totals handle missing days and malformed fields without NaN', () => {
  const result = summarizeReminders([undefined, null, 4, { completed: 2, confirmed: 1, skipped: 1, displaySeconds: 19 },
    { completed: 1, timedOut: 1, displaySeconds: 30 }, { completed: -1, skipped: '4', displaySeconds: Infinity }]);
  assert.deepEqual(result, { completed: 3, confirmed: 1, skipped: 1, timedOut: 1, displaySeconds: 49 });
  assert.deepEqual(summarizeReminders([]), { completed: 0, confirmed: 0, skipped: 0, timedOut: 0, displaySeconds: 0 });
});

test('recording water preserves legacy totals and accumulates new events', () => {
  const time = new Date('2026-10-22T01:00:00Z');
  const first = water.appendDrinkEntry(800, 200, 1000, time);
  const second = water.appendDrinkEntry(first, 100, 1000, time);
  assert.equal(first.total, 1000);
  assert.equal(second.total, 1100);
  assert.equal(second.entries.length, 2);
  assert.equal(second.goal, 1000);
});

test('trend summaries preserve saved goals and flag legacy estimates', () => {
  const dates = water.getRecentDates(3, new Date(2026, 0, 1));
  assert.deepEqual(dates.map(water.getLocalDateKey), ['20251230', '20251231', '20260101']);
  const result = water.summarizeDrinkDays(dates, [1500, { total: 1000, goal: 1000 }, undefined], 2000);
  assert.deepEqual(result.map(day => day.completed), [false, true, false]);
  assert.deepEqual(result.map(day => day.hasHistoricalGoal), [false, true, false]);
});

test('CSV export still includes both legacy totals and new drink events', () => {
  const csv = water.exportDrinkHistoryCsv([
    ['20261022', water.appendDrinkEntry(800, 200, 1000, new Date('2026-10-22T01:00:00Z'))],
    ['20261021', 500], ['metadata', 999],
  ], 1500);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"2026-10-21","500","1500","否","",""'));
  assert.ok(csv.includes('"2026-10-22","1000","1000","是","200","2026-10-22T01:00:00.000Z"'));
  assert.equal(csv.trim().split('\r\n').length, 3);
});
