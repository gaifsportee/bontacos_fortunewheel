const { test } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../server/db');

test('openDb creates tables and seeds a restaurant + prizes', () => {
  const db = openDb(':memory:');
  const restaurant = db.prepare('SELECT * FROM restaurant WHERE id=1').get();
  assert.ok(restaurant, 'restaurant row seeded');
  assert.strictEqual(restaurant.spin_window_seconds, 300);

  const prizeCount = db.prepare('SELECT COUNT(*) AS n FROM prizes').get().n;
  assert.ok(prizeCount >= 3, 'starter prizes seeded');

  // required tables exist
  for (const t of ['daily_codes', 'plays', 'feedback']) {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(t);
    assert.ok(row, `table ${t} exists`);
  }
});

test('openDb is idempotent (safe to call twice)', () => {
  const db = openDb(':memory:');
  const before = db.prepare('SELECT COUNT(*) AS n FROM prizes').get().n;
  // re-run schema/seed on same handle should not duplicate seed
  require('../server/db').initSchema(db);
  const after = db.prepare('SELECT COUNT(*) AS n FROM prizes').get().n;
  assert.strictEqual(before, after);
});
