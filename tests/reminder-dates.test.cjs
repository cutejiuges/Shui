const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { isCalendarDate, readDateOverrides, saveDateOverride, deleteDateOverride } = load('src/lib/reminder-dates.ts');

test('calendar dates validate leap years, month lengths and canonical format without UTC conversion', () => {
  for (const value of ['2028-02-29', '2000-02-29', '0001-01-01', '9999-12-31', '2026-11-14']) {
    assert.equal(isCalendarDate(value), true, value);
  }
  for (const value of ['', '2027-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-1-01', '2026-01-1', '2026-00-01', '2026-13-01', '2026-01-00', '2026-11-14T00:00:00Z', '+10000-01-01']) {
    assert.equal(isCalendarDate(value), false, value);
  }
});

test('legacy and damaged date settings fall back safely, valid duplicate entries use the last rule', () => {
  for (const value of [undefined, null, {}, ['2026-11-14'], [{date: '2027-02-29', remind: false}], [{date: '2026-11-14', remind: 'false'}], [{date: '2026-11-14', remind: true, unknown: true}]]) {
    assert.deepEqual(readDateOverrides(value), []);
  }
  assert.deepEqual(readDateOverrides([
    {date: '2028-02-29', remind: true},
    {date: '2026-11-14', remind: true},
    {date: '2026-11-14', remind: false},
  ]), [{date: '2026-11-14', remind: false}, {date: '2028-02-29', remind: true}]);
});

test('adding a rule sorts dates, rejects duplicates and preserves the original collection', () => {
  const original = [{date: '2028-02-29', remind: true}];
  const result = saveDateOverride(original, {date: '2026-11-14', remind: false});
  assert.deepEqual(result, [{date: '2026-11-14', remind: false}, ...original]);
  assert.deepEqual(original, [{date: '2028-02-29', remind: true}]);
  assert.throws(() => saveDateOverride(result, {date: '2026-11-14', remind: true}), /同一天/);
  assert.throws(() => saveDateOverride(result, {date: '2027-02-29', remind: true}), /有效日期/);
});

test('editing supports changing type and date without mutating saved input, deletion removes only the selected rule', () => {
  const original = [{date: '2026-11-14', remind: false}, {date: '2026-11-16', remind: true}];
  assert.deepEqual(saveDateOverride(original, {date: '2026-11-14', remind: true}, '2026-11-14'), [
    {date: '2026-11-14', remind: true}, original[1],
  ]);
  const moved = saveDateOverride(original, {date: '2026-11-15', remind: false}, '2026-11-14');
  assert.deepEqual(moved, [{date: '2026-11-15', remind: false}, original[1]]);
  assert.throws(() => saveDateOverride(original, {date: '2026-11-16', remind: false}, '2026-11-14'), /同一天/);
  assert.deepEqual(original, [{date: '2026-11-14', remind: false}, {date: '2026-11-16', remind: true}]);
  assert.deepEqual(deleteDateOverride(moved, '2026-11-15'), [original[1]]);
  assert.deepEqual(deleteDateOverride([original[1]], '2026-11-16'), []);
});
