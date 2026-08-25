const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { openDb } = require('../server/db');
const { createApp } = require('../server/app');

test('GET /api/config returns restaurant name and wheel slices', async () => {
  const db = openDb(':memory:');
  const app = createApp(db);
  const res = await request(app).get('/api/config');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.name, 'BON TACOS');
  assert.ok(Array.isArray(res.body.slices));
  assert.ok(res.body.slices.length >= 3);
  // slices expose only display fields, never weight or cap
  assert.ok('label' in res.body.slices[0]);
  assert.ok(!('weight' in res.body.slices[0]));
});
