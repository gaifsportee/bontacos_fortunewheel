const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { openDb } = require('../server/db');
const { getOrCreateTodayCode } = require('../server/dailyCode');
const { today } = require('../server/util');
const { createApp } = require('../server/app');

function setup() {
  const db = openDb(':memory:');
  const app = createApp(db);
  const code = getOrCreateTodayCode(db, today());
  return { db, app, code };
}

test('POST /api/play rejects a missing device id', async () => {
  const { app, code } = setup();
  const res = await request(app).post('/api/play').send({ code });
  assert.strictEqual(res.status, 400);
});

test('POST /api/play rejects a wrong code', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/play').send({ code: 'NOPE00', deviceId: 'dev-1' });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.error, 'bad_code');
});

test('POST /api/play with the right code returns a prize + win code', async () => {
  const { app, code } = setup();
  const res = await request(app).post('/api/play').send({ code, deviceId: 'dev-1' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.alreadyPlayed, false);
  assert.ok(res.body.winningIndex >= 0);
  assert.match(res.body.winCode, /^[A-Z0-9]{6}$/);
  assert.ok(res.body.prize.label);
  assert.ok(res.body.expiresAt);
});

test('POST /api/play is case-insensitive on the code', async () => {
  const { app, code } = setup();
  const res = await request(app).post('/api/play').send({ code: code.toLowerCase(), deviceId: 'dev-9' });
  assert.strictEqual(res.status, 200);
});

test('POST /api/play blocks a second play from the same device that day', async () => {
  const { app, code } = setup();
  const first = await request(app).post('/api/play').send({ code, deviceId: 'dev-2' });
  const second = await request(app).post('/api/play').send({ code, deviceId: 'dev-2' });
  assert.strictEqual(second.status, 200);
  assert.strictEqual(second.body.alreadyPlayed, true);
  assert.strictEqual(second.body.winCode, first.body.winCode); // same prize returned
});
