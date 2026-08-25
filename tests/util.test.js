const { test } = require('node:test');
const assert = require('node:assert');
const { today, nowIso, genWinCode } = require('../server/util');

test('today formats a date as YYYY-MM-DD', () => {
  const d = new Date(2026, 7, 25); // month is 0-based -> August
  assert.strictEqual(today(d), '2026-08-25');
});

test('nowIso returns an ISO 8601 string', () => {
  assert.match(nowIso(), /^\d{4}-\d{2}-\d{2}T/);
});

test('genWinCode returns 6 unambiguous chars', () => {
  const c = genWinCode();
  assert.match(c, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});
