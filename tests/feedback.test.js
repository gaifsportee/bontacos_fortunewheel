const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { openDb } = require('../server/db');
const { createApp } = require('../server/app');

test('POST /api/feedback logs a thumbs-up', async () => {
  const db = openDb(':memory:');
  const app = createApp(db);
  const res = await request(app).post('/api/feedback').send({ sentiment: 'up' });
  assert.strictEqual(res.status, 201);
  const row = db.prepare("SELECT * FROM feedback WHERE kind='up'").get();
  assert.ok(row);
});

test('POST /api/feedback logs a thumbs-down with text', async () => {
  const db = openDb(':memory:');
  const app = createApp(db);
  const res = await request(app).post('/api/feedback').send({ sentiment: 'down', text: 'Cold food' });
  assert.strictEqual(res.status, 201);
  const row = db.prepare("SELECT * FROM feedback WHERE kind='down'").get();
  assert.strictEqual(row.text, 'Cold food');
});

test('POST /api/feedback rejects an invalid sentiment', async () => {
  const db = openDb(':memory:');
  const app = createApp(db);
  const res = await request(app).post('/api/feedback').send({ sentiment: 'sideways' });
  assert.strictEqual(res.status, 400);
});

test('POST /api/lead stores an opt-in email', async () => {
  const db = openDb(':memory:');
  const app = createApp(db);
  const res = await request(app).post('/api/lead').send({ email: 'a@b.com' });
  assert.strictEqual(res.status, 201);
  const row = db.prepare("SELECT * FROM feedback WHERE kind='lead'").get();
  assert.strictEqual(row.email, 'a@b.com');
});

test('POST /api/lead rejects when neither email nor phone given', async () => {
  const db = openDb(':memory:');
  const app = createApp(db);
  const res = await request(app).post('/api/lead').send({});
  assert.strictEqual(res.status, 400);
});
