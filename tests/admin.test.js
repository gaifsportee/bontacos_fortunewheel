const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { openDb } = require('../server/db');
const { createApp } = require('../server/app');

const PW = 'secret';
function setup() {
  const db = openDb(':memory:');
  const app = createApp(db, { adminPassword: PW });
  return { db, app };
}
const auth = (r) => r.set('x-admin-password', PW);

test('admin routes reject a missing/wrong password', async () => {
  const { app } = setup();
  const res = await request(app).get('/api/admin/code');
  assert.strictEqual(res.status, 401);
});

test('GET /api/admin/code returns today code', async () => {
  const { app } = setup();
  const res = await auth(request(app).get('/api/admin/code'));
  assert.strictEqual(res.status, 200);
  assert.match(res.body.code, /^[A-Z]+\d{2}$/);
});

test('POST /api/admin/code/rotate changes the code', async () => {
  const { app } = setup();
  const a = (await auth(request(app).get('/api/admin/code'))).body.code;
  const b = (await auth(request(app).post('/api/admin/code/rotate'))).body.code;
  assert.notStrictEqual(a, b);
});

test('prizes CRUD: create, list, update, delete', async () => {
  const { app } = setup();
  const created = await auth(request(app).post('/api/admin/prizes'))
    .send({ label: 'Free hat', emoji: '🧢', color: '#111', weight: 5, daily_cap: 3 });
  assert.strictEqual(created.status, 201);
  const id = created.body.id;

  const list = await auth(request(app).get('/api/admin/prizes'));
  assert.ok(list.body.some((p) => p.id === id));

  const upd = await auth(request(app).put(`/api/admin/prizes/${id}`)).send({ weight: 9 });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.body.weight, 9);

  const del = await auth(request(app).delete(`/api/admin/prizes/${id}`));
  assert.strictEqual(del.status, 200);
  const list2 = await auth(request(app).get('/api/admin/prizes'));
  assert.ok(!list2.body.some((p) => p.id === id));
});

test('GET /api/admin/stats returns counts', async () => {
  const { app } = setup();
  const res = await auth(request(app).get('/api/admin/stats'));
  assert.strictEqual(res.status, 200);
  assert.ok('plays' in res.body);
  assert.ok('winsByPrize' in res.body);
  assert.ok('thumbsUp' in res.body);
  assert.ok('thumbsDown' in res.body);
  assert.ok('leads' in res.body);
});

test('GET /api/admin/feedback.csv returns CSV text', async () => {
  const { app } = setup();
  const res = await auth(request(app).get('/api/admin/feedback.csv'));
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.text, /created_at,kind/);
});

test('GET/PUT /api/admin/settings reads and updates the restaurant row', async () => {
  const { app } = setup();
  const before = await auth(request(app).get('/api/admin/settings'));
  assert.strictEqual(before.status, 200);
  assert.strictEqual(before.body.name, 'BON TACOS');

  const upd = await auth(request(app).put('/api/admin/settings'))
    .send({ google_review_url: 'https://example.com/review', name: 'Bon Tacos Nice' });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.body.google_review_url, 'https://example.com/review');
  assert.strictEqual(upd.body.name, 'Bon Tacos Nice');
});
