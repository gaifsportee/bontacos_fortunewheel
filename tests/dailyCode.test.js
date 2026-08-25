const { test } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../server/db');
const { generateCode, getOrCreateTodayCode, rotateCode } = require('../server/dailyCode');

test('generateCode returns WORD + 2 digits', () => {
  assert.match(generateCode(), /^[A-Z]+\d{2}$/);
});

test('getOrCreateTodayCode is stable within a day', () => {
  const db = openDb(':memory:');
  const a = getOrCreateTodayCode(db, '2026-08-25');
  const b = getOrCreateTodayCode(db, '2026-08-25');
  assert.strictEqual(a, b);
});

test('rotateCode replaces the code for the day', () => {
  const db = openDb(':memory:');
  const a = getOrCreateTodayCode(db, '2026-08-25');
  const b = rotateCode(db, '2026-08-25');
  assert.notStrictEqual(a, b);
  assert.strictEqual(getOrCreateTodayCode(db, '2026-08-25'), b);
});
