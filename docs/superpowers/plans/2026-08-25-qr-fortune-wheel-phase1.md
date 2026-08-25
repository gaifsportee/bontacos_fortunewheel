# QR Fortune Wheel — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-runnable web app where a customer scans a QR, enters a daily staff code, spins a weighted fortune wheel, sees a prize with a countdown, and is then asked (optionally) for a Google review or private feedback — plus a simple admin page to manage prizes, odds, the daily code, and stats.

**Architecture:** A single Node/Express server serves a static mobile web page (the wheel) and a small JSON API. The server is the source of truth: it holds the daily code, picks the prize server-side using weighted odds + daily caps, logs every play, and blocks repeat plays. Data lives in a local SQLite file via `better-sqlite3` (synchronous, zero external service). The player page also supports a `?mode=kiosk` switch so the same code runs on a Phase 2 tablet with a physical button.

**Tech Stack:** Node.js (18+), Express 4, better-sqlite3, vanilla HTML/CSS/JS frontend (canvas wheel), `node:test` + supertest for testing.

**Spec:** `docs/superpowers/specs/2026-08-25-qr-fortune-wheel-reviews-design.md`

---

## File Structure

```
package.json
.gitignore                     # add data/ and node_modules/
server/
  util.js                      # today(), nowIso(), genWinCode()
  db.js                        # openDb(path): schema + seed, returns better-sqlite3 handle
  dailyCode.js                 # generateCode(), getOrCreateTodayCode(), rotateCode()
  prizes.js                    # getEligible(), selectPrize()  (pure, testable)
  app.js                       # createApp(db, opts): wires routers + static
  server.js                    # entry point: opens db, app.listen()
  routes/
    config.js                  # GET /api/config          (public)
    play.js                    # POST /api/play           (unlock + spin)
    feedback.js                # POST /api/feedback, POST /api/lead
    admin.js                   # admin API (code, prizes CRUD, stats, feedback)
public/
  index.html                   # player page
  styles.css
  wheel.js                     # canvas wheel render + spin animation
  player.js                    # player flow controller
  admin.html                   # admin page
  admin.js
tests/
  db.test.js
  dailyCode.test.js
  prizes.test.js
  play.test.js
  feedback.test.js
  config.test.js
  admin.test.js
data/                          # sqlite file created at runtime (gitignored)
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "bontacos-fortunewheel",
  "version": "0.1.0",
  "description": "QR fortune wheel + reviews for BON TACOS",
  "main": "server/server.js",
  "scripts": {
    "start": "node server/server.js",
    "dev": "node --watch server/server.js",
    "test": "node --test"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Add `data/` to `.gitignore`**

Append these lines to the existing `.gitignore`:

```
# App data
data/
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: completes without error; `node_modules/` created. (better-sqlite3 ships prebuilt binaries; if it tries to compile and fails on Windows, install "Desktop development with C++" via Visual Studio Build Tools, then re-run `npm install`.)

- [ ] **Step 4: Verify the test runner works**

Run: `npm test`
Expected: exits 0 with "no test files found" or similar (no tests yet).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold Node/Express project"
```

---

## Task 2: Utilities (`server/util.js`)

**Files:**
- Create: `server/util.js`
- Test: `tests/util` covered inside `tests/db.test.js` header (small); create dedicated `tests/util.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/util.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/util.test.js`
Expected: FAIL — cannot find module `../server/util`.

- [ ] **Step 3: Write minimal implementation** — create `server/util.js`

```js
function today(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nowIso(date = new Date()) {
  return date.toISOString();
}

function genWinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

module.exports = { today, nowIso, genWinCode };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/util.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/util.js tests/util.test.js
git commit -m "feat: add date/code utilities"
```

---

## Task 3: Database schema + seed (`server/db.js`)

**Files:**
- Create: `server/db.js`
- Test: `tests/db.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/db.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/db.test.js`
Expected: FAIL — cannot find module `../server/db`.

- [ ] **Step 3: Write minimal implementation** — create `server/db.js`

```js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS restaurant (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  logo_url TEXT,
  google_review_url TEXT,
  spin_window_seconds INTEGER NOT NULL DEFAULT 300
);
CREATE TABLE IF NOT EXISTS daily_codes (
  date TEXT PRIMARY KEY,
  code TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  emoji TEXT,
  color TEXT NOT NULL DEFAULT '#f4a340',
  weight INTEGER NOT NULL DEFAULT 1,
  daily_cap INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  play_date TEXT NOT NULL,
  prize_id INTEGER NOT NULL,
  win_code TEXT NOT NULL UNIQUE,
  device_id TEXT NOT NULL,
  redeemed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (prize_id) REFERENCES prizes(id)
);
CREATE INDEX IF NOT EXISTS idx_plays_device_date ON plays(device_id, play_date);
CREATE INDEX IF NOT EXISTS idx_plays_date ON plays(play_date);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT,
  email TEXT,
  phone TEXT
);
`;

const STARTER_PRIZES = [
  { label: '10% off',        emoji: '💸', color: '#f4a340', weight: 40, daily_cap: null },
  { label: 'Free drink',     emoji: '🥤', color: '#e8564b', weight: 25, daily_cap: null },
  { label: 'Free churros',   emoji: '🍩', color: '#6ac07a', weight: 15, daily_cap: 20 },
  { label: 'Free nachos',    emoji: '🧀', color: '#f2c14e', weight: 10, daily_cap: 10 },
  { label: 'Free meal',      emoji: '🌮', color: '#7d5fff', weight: 2,  daily_cap: 2 },
  { label: 'Try again free', emoji: '🎁', color: '#4aa3df', weight: 8,  daily_cap: null },
];

function initSchema(db) {
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  const hasRestaurant = db.prepare('SELECT COUNT(*) AS n FROM restaurant').get().n;
  if (!hasRestaurant) {
    db.prepare(
      `INSERT INTO restaurant (id, name, logo_url, google_review_url, spin_window_seconds)
       VALUES (1, ?, ?, ?, 300)`
    ).run('BON TACOS', '', 'https://search.google.com/local/writereview?placeid=REPLACE_ME');
  }
  const hasPrizes = db.prepare('SELECT COUNT(*) AS n FROM prizes').get().n;
  if (!hasPrizes) {
    const insert = db.prepare(
      'INSERT INTO prizes (label, emoji, color, weight, daily_cap) VALUES (?, ?, ?, ?, ?)'
    );
    const tx = db.transaction((rows) => rows.forEach((p) =>
      insert.run(p.label, p.emoji, p.color, p.weight, p.daily_cap)));
    tx(STARTER_PRIZES);
  }
}

function openDb(file = path.join(__dirname, '..', 'data', 'app.db')) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  initSchema(db);
  return db;
}

module.exports = { openDb, initSchema };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/db.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/db.js tests/db.test.js
git commit -m "feat: add SQLite schema and seed data"
```

---

## Task 4: Daily code (`server/dailyCode.js`)

**Files:**
- Create: `server/dailyCode.js`
- Test: `tests/dailyCode.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/dailyCode.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/dailyCode.test.js`
Expected: FAIL — cannot find module `../server/dailyCode`.

- [ ] **Step 3: Write minimal implementation** — create `server/dailyCode.js`

```js
const WORDS = ['TACO', 'SALSA', 'NACHO', 'QUESO', 'FIESTA', 'CHILI', 'MANGO', 'LIME'];

function generateCode() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const num = String(Math.floor(10 + Math.random() * 90)); // 10..99
  return word + num;
}

function getOrCreateTodayCode(db, date) {
  const row = db.prepare('SELECT code FROM daily_codes WHERE date=?').get(date);
  if (row) return row.code;
  const code = generateCode();
  db.prepare('INSERT INTO daily_codes (date, code) VALUES (?, ?)').run(date, code);
  return code;
}

function rotateCode(db, date) {
  let code = generateCode();
  const current = db.prepare('SELECT code FROM daily_codes WHERE date=?').get(date);
  while (current && code === current.code) code = generateCode(); // guarantee a change
  db.prepare(
    `INSERT INTO daily_codes (date, code) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET code=excluded.code`
  ).run(date, code);
  return code;
}

module.exports = { generateCode, getOrCreateTodayCode, rotateCode };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/dailyCode.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/dailyCode.js tests/dailyCode.test.js
git commit -m "feat: add daily unlock code logic"
```

---

## Task 5: Prize selection (`server/prizes.js`)

**Files:**
- Create: `server/prizes.js`
- Test: `tests/prizes.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/prizes.test.js`

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { getEligible, selectPrize } = require('../server/prizes');

const PRIZES = [
  { id: 1, label: '10% off',  weight: 40, daily_cap: null },
  { id: 2, label: 'Free meal', weight: 2, daily_cap: 2 },
  { id: 3, label: 'Zero',     weight: 0, daily_cap: null },
];

test('getEligible drops weight<=0 prizes', () => {
  const e = getEligible(PRIZES, {});
  assert.deepStrictEqual(e.map((p) => p.id), [1, 2]);
});

test('getEligible drops prizes at their daily cap', () => {
  const e = getEligible(PRIZES, { 2: 2 }); // free meal already awarded twice
  assert.deepStrictEqual(e.map((p) => p.id), [1]);
});

test('getEligible falls back to uncapped prizes when all capped', () => {
  const capped = [{ id: 9, label: 'X', weight: 5, daily_cap: 1 }];
  const withUncapped = [...capped, { id: 1, label: '10% off', weight: 40, daily_cap: null }];
  const e = getEligible(withUncapped, { 9: 1 });
  assert.deepStrictEqual(e.map((p) => p.id), [1]);
});

test('selectPrize is weighted (deterministic via injected rng)', () => {
  const eligible = [
    { id: 1, weight: 40 },
    { id: 2, weight: 2 },
  ];
  // rng just below the 40/42 boundary picks id 1; just above picks id 2
  assert.strictEqual(selectPrize(eligible, () => 0.5).id, 1);
  assert.strictEqual(selectPrize(eligible, () => 0.99).id, 2);
});

test('selectPrize distribution roughly matches weights', () => {
  const eligible = [
    { id: 1, weight: 90 },
    { id: 2, weight: 10 },
  ];
  let ones = 0;
  for (let i = 0; i < 5000; i++) if (selectPrize(eligible).id === 1) ones++;
  const ratio = ones / 5000;
  assert.ok(ratio > 0.85 && ratio < 0.95, `expected ~0.9, got ${ratio}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/prizes.test.js`
Expected: FAIL — cannot find module `../server/prizes`.

- [ ] **Step 3: Write minimal implementation** — create `server/prizes.js`

```js
// prizes: array of active prize rows. counts: { [prizeId]: awardedToday }
function getEligible(prizes, counts) {
  const withWeight = prizes.filter((p) => p.weight > 0);
  const underCap = withWeight.filter(
    (p) => p.daily_cap == null || (counts[p.id] || 0) < p.daily_cap
  );
  if (underCap.length > 0) return underCap;
  // everything capped -> consolation: any uncapped active prize
  const uncapped = prizes.filter((p) => p.daily_cap == null);
  return uncapped.length > 0 ? uncapped : prizes.slice();
}

function selectPrize(eligible, rng = Math.random) {
  const total = eligible.reduce((s, p) => s + p.weight, 0);
  let r = rng() * total;
  for (const p of eligible) {
    r -= p.weight;
    if (r < 0) return p;
  }
  return eligible[eligible.length - 1];
}

module.exports = { getEligible, selectPrize };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/prizes.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/prizes.js tests/prizes.test.js
git commit -m "feat: add weighted prize selection with daily caps"
```

---

## Task 6: App factory + config route (`server/app.js`, `server/routes/config.js`)

**Files:**
- Create: `server/app.js`, `server/routes/config.js`
- Test: `tests/config.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/config.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/config.test.js`
Expected: FAIL — cannot find module `../server/app`.

- [ ] **Step 3: Write `server/routes/config.js`**

```js
const express = require('express');

function createConfigRouter(db) {
  const router = express.Router();
  router.get('/config', (req, res) => {
    const r = db.prepare('SELECT name, logo_url, google_review_url FROM restaurant WHERE id=1').get();
    const slices = db
      .prepare('SELECT id, label, emoji, color FROM prizes WHERE active=1 ORDER BY id')
      .all();
    res.json({
      name: r.name,
      logoUrl: r.logo_url,
      googleReviewUrl: r.google_review_url,
      slices,
    });
  });
  return router;
}

module.exports = { createConfigRouter };
```

- [ ] **Step 4: Write `server/app.js`** (routers for play/feedback/admin are added in later tasks; import them once they exist)

```js
const express = require('express');
const path = require('path');
const { createConfigRouter } = require('./routes/config');
const { createPlayRouter } = require('./routes/play');
const { createFeedbackRouter } = require('./routes/feedback');
const { createAdminRouter } = require('./routes/admin');

function createApp(db, opts = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api', createConfigRouter(db));
  app.use('/api', createPlayRouter(db));
  app.use('/api', createFeedbackRouter(db));
  app.use('/api/admin', createAdminRouter(db, opts));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  return app;
}

module.exports = { createApp };
```

> NOTE: `server/app.js` imports `play`, `feedback`, and `admin` routers that are created in Tasks 7–9. To run this task's test in isolation before those exist, temporarily comment out those three `require` lines and their `app.use` lines, run the test, then restore them. They are created next.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/config.test.js`
Expected: PASS (1 test). (With the temporary comments from the note, if the later routers don't exist yet.)

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/routes/config.js tests/config.test.js
git commit -m "feat: add app factory and public config route"
```

---

## Task 7: Play route (`server/routes/play.js`)

**Files:**
- Create: `server/routes/play.js`
- Test: `tests/play.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/play.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/play.test.js`
Expected: FAIL — cannot find module `../server/routes/play` (or app.js import error).

- [ ] **Step 3: Write minimal implementation** — create `server/routes/play.js`

```js
const express = require('express');
const { getOrCreateTodayCode } = require('../dailyCode');
const { getEligible, selectPrize } = require('../prizes');
const { today, nowIso, genWinCode } = require('../util');

function expiresAtFrom(db, createdAtIso) {
  const secs = db.prepare('SELECT spin_window_seconds AS s FROM restaurant WHERE id=1').get().s;
  return new Date(new Date(createdAtIso).getTime() + secs * 1000).toISOString();
}

function todayCounts(db, date) {
  const rows = db
    .prepare('SELECT prize_id, COUNT(*) AS n FROM plays WHERE play_date=? GROUP BY prize_id')
    .all(date);
  const counts = {};
  for (const r of rows) counts[r.prize_id] = r.n;
  return counts;
}

function createPlayRouter(db) {
  const router = express.Router();

  router.post('/play', (req, res) => {
    const { code, deviceId } = req.body || {};
    if (!deviceId) return res.status(400).json({ error: 'missing_device' });

    const date = today();
    const dayCode = getOrCreateTodayCode(db, date);
    if (!code || String(code).trim().toUpperCase() !== dayCode.toUpperCase()) {
      return res.status(403).json({ error: 'bad_code' });
    }

    const slices = db.prepare('SELECT id, label, emoji, color FROM prizes WHERE active=1 ORDER BY id').all();

    const existing = db.prepare('SELECT * FROM plays WHERE device_id=? AND play_date=?').get(deviceId, date);
    if (existing) {
      const idx = slices.findIndex((s) => s.id === existing.prize_id);
      return res.json({
        alreadyPlayed: true,
        winningIndex: idx,
        prize: slices[idx],
        winCode: existing.win_code,
        expiresAt: expiresAtFrom(db, existing.created_at),
      });
    }

    const activePrizes = db.prepare('SELECT * FROM prizes WHERE active=1 ORDER BY id').all();
    const eligible = getEligible(activePrizes, todayCounts(db, date));
    const chosen = selectPrize(eligible);

    const winCode = genWinCode();
    const createdAt = nowIso();
    db.prepare(
      `INSERT INTO plays (created_at, play_date, prize_id, win_code, device_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(createdAt, date, chosen.id, winCode, deviceId);

    const idx = slices.findIndex((s) => s.id === chosen.id);
    res.json({
      alreadyPlayed: false,
      winningIndex: idx,
      prize: slices[idx],
      winCode,
      expiresAt: expiresAtFrom(db, createdAt),
    });
  });

  return router;
}

module.exports = { createPlayRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/play.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/routes/play.js tests/play.test.js
git commit -m "feat: add play route (unlock + weighted spin + replay guard)"
```

---

## Task 8: Feedback + lead routes (`server/routes/feedback.js`)

**Files:**
- Create: `server/routes/feedback.js`
- Test: `tests/feedback.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/feedback.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/feedback.test.js`
Expected: FAIL — cannot find module `../server/routes/feedback`.

- [ ] **Step 3: Write minimal implementation** — create `server/routes/feedback.js`

```js
const express = require('express');
const { nowIso } = require('../util');

function createFeedbackRouter(db) {
  const router = express.Router();

  router.post('/feedback', (req, res) => {
    const { sentiment, text } = req.body || {};
    if (sentiment !== 'up' && sentiment !== 'down') {
      return res.status(400).json({ error: 'bad_sentiment' });
    }
    db.prepare('INSERT INTO feedback (created_at, kind, text) VALUES (?, ?, ?)')
      .run(nowIso(), sentiment, sentiment === 'down' ? (text || null) : null);
    res.status(201).json({ ok: true });
  });

  router.post('/lead', (req, res) => {
    const { email, phone } = req.body || {};
    if (!email && !phone) return res.status(400).json({ error: 'missing_contact' });
    db.prepare('INSERT INTO feedback (created_at, kind, email, phone) VALUES (?, ?, ?, ?)')
      .run(nowIso(), 'lead', email || null, phone || null);
    res.status(201).json({ ok: true });
  });

  return router;
}

module.exports = { createFeedbackRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/feedback.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/routes/feedback.js tests/feedback.test.js
git commit -m "feat: add feedback and lead capture routes"
```

---

## Task 9: Admin API (`server/routes/admin.js`)

**Files:**
- Create: `server/routes/admin.js`
- Test: `tests/admin.test.js`

- [ ] **Step 1: Write the failing test** — create `tests/admin.test.js`

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/admin.test.js`
Expected: FAIL — cannot find module `../server/routes/admin`.

- [ ] **Step 3: Write minimal implementation** — create `server/routes/admin.js`

```js
const express = require('express');
const { getOrCreateTodayCode, rotateCode } = require('../dailyCode');
const { today } = require('../util');

function requireAdmin(password) {
  return (req, res, next) => {
    if (req.get('x-admin-password') !== password) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    next();
  };
}

function createAdminRouter(db, opts = {}) {
  const password = opts.adminPassword || process.env.ADMIN_PASSWORD || 'changeme';
  const router = express.Router();
  router.use(requireAdmin(password));

  router.get('/code', (req, res) => {
    res.json({ date: today(), code: getOrCreateTodayCode(db, today()) });
  });

  router.post('/code/rotate', (req, res) => {
    res.json({ date: today(), code: rotateCode(db, today()) });
  });

  router.get('/settings', (req, res) => {
    res.json(db.prepare('SELECT name, logo_url, google_review_url, spin_window_seconds FROM restaurant WHERE id=1').get());
  });

  router.put('/settings', (req, res) => {
    const cur = db.prepare('SELECT name, logo_url, google_review_url, spin_window_seconds FROM restaurant WHERE id=1').get();
    const m = { ...cur };
    for (const f of ['name', 'logo_url', 'google_review_url', 'spin_window_seconds']) {
      if (f in (req.body || {})) m[f] = req.body[f];
    }
    db.prepare('UPDATE restaurant SET name=?, logo_url=?, google_review_url=?, spin_window_seconds=? WHERE id=1')
      .run(m.name, m.logo_url, m.google_review_url, m.spin_window_seconds);
    res.json(m);
  });

  router.get('/prizes', (req, res) => {
    res.json(db.prepare('SELECT * FROM prizes ORDER BY id').all());
  });

  router.post('/prizes', (req, res) => {
    const { label, emoji, color, weight, daily_cap, active } = req.body || {};
    if (!label) return res.status(400).json({ error: 'missing_label' });
    const info = db.prepare(
      `INSERT INTO prizes (label, emoji, color, weight, daily_cap, active)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(label, emoji || '', color || '#f4a340', weight ?? 1,
          daily_cap ?? null, active == null ? 1 : active ? 1 : 0);
    res.status(201).json(db.prepare('SELECT * FROM prizes WHERE id=?').get(info.lastInsertRowid));
  });

  router.put('/prizes/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM prizes WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'not_found' });
    const fields = ['label', 'emoji', 'color', 'weight', 'daily_cap', 'active'];
    const merged = { ...existing };
    for (const f of fields) if (f in (req.body || {})) merged[f] = req.body[f];
    db.prepare(
      `UPDATE prizes SET label=?, emoji=?, color=?, weight=?, daily_cap=?, active=? WHERE id=?`
    ).run(merged.label, merged.emoji, merged.color, merged.weight,
          merged.daily_cap, merged.active ? 1 : 0, req.params.id);
    res.json(db.prepare('SELECT * FROM prizes WHERE id=?').get(req.params.id));
  });

  router.delete('/prizes/:id', (req, res) => {
    db.prepare('DELETE FROM prizes WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  });

  router.get('/stats', (req, res) => {
    const days = Math.max(1, parseInt(req.query.days, 10) || 30);
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const plays = db.prepare('SELECT COUNT(*) AS n FROM plays WHERE play_date >= ?').get(since).n;
    const winsByPrize = db.prepare(
      `SELECT p.label AS label, COUNT(*) AS n
       FROM plays pl JOIN prizes p ON p.id = pl.prize_id
       WHERE pl.play_date >= ? GROUP BY p.id ORDER BY n DESC`
    ).all(since);
    const countKind = (kind) => db.prepare(
      "SELECT COUNT(*) AS n FROM feedback WHERE kind=? AND substr(created_at,1,10) >= ?"
    ).get(kind, since).n;
    res.json({
      days,
      plays,
      winsByPrize,
      thumbsUp: countKind('up'),
      thumbsDown: countKind('down'),
      leads: countKind('lead'),
    });
  });

  router.get('/feedback', (req, res) => {
    res.json(db.prepare('SELECT * FROM feedback ORDER BY id DESC').all());
  });

  router.get('/feedback.csv', (req, res) => {
    const rows = db.prepare('SELECT created_at, kind, text, email, phone FROM feedback ORDER BY id DESC').all();
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = 'created_at,kind,text,email,phone';
    const body = rows.map((r) => [r.created_at, r.kind, r.text, r.email, r.phone].map(esc).join(',')).join('\n');
    res.set('Content-Type', 'text/csv').send(header + '\n' + body + '\n');
  });

  return router;
}

module.exports = { createAdminRouter };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/admin.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all tests across all files PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/admin.js tests/admin.test.js
git commit -m "feat: add admin API (code, prizes CRUD, stats, feedback export)"
```

---

## Task 10: Server entry point (`server/server.js`)

**Files:**
- Create: `server/server.js`

- [ ] **Step 1: Write `server/server.js`**

```js
const { openDb } = require('./db');
const { createApp } = require('./app');

const db = openDb(); // data/app.db
const app = createApp(db, { adminPassword: process.env.ADMIN_PASSWORD || 'changeme' });
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`BON TACOS fortune wheel running: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin.html  (password: ${process.env.ADMIN_PASSWORD || 'changeme'})`);
});
```

- [ ] **Step 2: Start the server**

Run: `npm start`
Expected: logs "running: http://localhost:3000". Leave it running for the next tasks (or restart as needed).

- [ ] **Step 3: Smoke-test the API manually**

Run in a second terminal:
```bash
curl http://localhost:3000/api/config
```
Expected: JSON with `"name":"BON TACOS"` and a `slices` array.

- [ ] **Step 4: Commit**

```bash
git add server/server.js
git commit -m "feat: add server entry point"
```

---

## Task 11: Player page — markup & styles (`public/index.html`, `public/styles.css`)

> Frontend canvas/animation is verified manually in the browser rather than unit-tested. Each step gives complete code plus an explicit check.

**Files:**
- Create: `public/index.html`, `public/styles.css`

- [ ] **Step 1: Create `public/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>BON TACOS — Spin to Win</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main id="app">
    <!-- Welcome -->
    <section id="screen-welcome" class="screen active">
      <img id="logo" alt="" hidden />
      <h1 id="title">Spin to win! 🌮</h1>
      <p class="sub">Play our wheel and win a treat.</p>
      <button id="btn-start" class="primary">Start</button>
    </section>

    <!-- Unlock -->
    <section id="screen-unlock" class="screen">
      <h2>Enter today's code</h2>
      <p class="sub">Ask your server for the code.</p>
      <input id="code-input" inputmode="text" autocapitalize="characters" placeholder="e.g. TACO42" />
      <p id="code-error" class="error" hidden>That code isn't right — check with your server.</p>
      <button id="btn-unlock" class="primary">Unlock</button>
    </section>

    <!-- Wheel -->
    <section id="screen-wheel" class="screen">
      <canvas id="wheel" width="320" height="320"></canvas>
      <button id="btn-spin" class="primary">SPIN</button>
    </section>

    <!-- Prize -->
    <section id="screen-prize" class="screen">
      <h2 id="prize-title">🎉 You won!</h2>
      <div id="prize-label" class="prize-label"></div>
      <p class="sub">Show your server before it expires:</p>
      <div id="win-code" class="win-code"></div>
      <div id="countdown" class="countdown"></div>
      <button id="btn-to-review" class="primary">Next</button>
    </section>

    <!-- Review ask -->
    <section id="screen-review" class="screen">
      <h2>How was it?</h2>
      <div class="thumbs">
        <button id="btn-up" class="thumb">👍</button>
        <button id="btn-down" class="thumb">👎</button>
      </div>
      <button id="btn-skip-review" class="link">Skip</button>
    </section>

    <!-- Private feedback -->
    <section id="screen-feedback" class="screen">
      <h2>Sorry about that 🙏</h2>
      <p class="sub">Tell us what went wrong — it comes straight to us.</p>
      <textarea id="feedback-text" rows="4" placeholder="What happened?"></textarea>
      <button id="btn-send-feedback" class="primary">Send</button>
    </section>

    <!-- Lead / save coupon -->
    <section id="screen-lead" class="screen">
      <h2>Want your coupon emailed?</h2>
      <input id="lead-email" type="email" inputmode="email" placeholder="you@email.com" />
      <button id="btn-save-lead" class="primary">Save it</button>
      <button id="btn-skip-lead" class="link">No thanks</button>
    </section>

    <!-- Done -->
    <section id="screen-done" class="screen">
      <h2>Enjoy! 🌮</h2>
      <p class="sub">See you again at BON TACOS.</p>
    </section>
  </main>
  <script src="wheel.js"></script>
  <script src="player.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/styles.css`**

```css
:root {
  --bg: #1c1330;
  --card: #2a1e46;
  --accent: #f4a340;
  --accent2: #e8564b;
  --text: #fff;
  --muted: #c9bfe0;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
#app { max-width: 460px; margin: 0 auto; padding: 24px 20px; }
.screen { display: none; text-align: center; animation: fade .3s ease; }
.screen.active { display: block; }
@keyframes fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; } }
h1 { font-size: 2rem; margin: 12px 0; }
.sub { color: var(--muted); }
.error { color: #ff9b9b; }
input, textarea {
  width: 100%; padding: 14px; margin: 12px 0; border-radius: 12px;
  border: 2px solid #4a3a70; background: var(--card); color: var(--text);
  font-size: 1.1rem; text-align: center;
}
button.primary {
  width: 100%; padding: 16px; border: 0; border-radius: 14px;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  color: #1a1030; font-size: 1.2rem; font-weight: 700; cursor: pointer;
}
button.primary:active { transform: scale(0.98); }
button.link { background: none; border: 0; color: var(--muted); margin-top: 12px; cursor: pointer; }
#logo { max-width: 120px; margin: 0 auto 8px; display: block; }
#wheel { display: block; margin: 0 auto 20px; touch-action: manipulation; }
.prize-label { font-size: 1.8rem; font-weight: 800; margin: 10px 0; }
.win-code {
  font-size: 2rem; letter-spacing: 4px; font-weight: 800;
  background: var(--card); padding: 12px; border-radius: 12px; margin: 10px 0;
}
.countdown { font-size: 1.2rem; color: var(--accent); font-weight: 700; }
.thumbs { display: flex; gap: 16px; justify-content: center; margin: 20px 0; }
.thumb { font-size: 3rem; background: var(--card); border: 0; border-radius: 16px; padding: 16px 24px; cursor: pointer; }
```

- [ ] **Step 3: Verify in the browser**

With the server running, open `http://localhost:3000/` on a desktop browser (and toggle mobile view in dev tools).
Expected: the Welcome screen shows with a Start button, styled dark/orange. Other screens are hidden.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/styles.css
git commit -m "feat: add player page markup and styles"
```

---

## Task 12: Wheel rendering + spin animation (`public/wheel.js`)

**Files:**
- Create: `public/wheel.js`

- [ ] **Step 1: Create `public/wheel.js`**

```js
// Renders a wheel on a canvas and animates a spin that lands on a target slice.
(function () {
  function drawWheel(canvas, slices, rotation) {
    const ctx = canvas.getContext('2d');
    const n = slices.length;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(cx, cy) - 6;
    const arc = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < n; i++) {
      const start = rotation + i * arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + arc);
      ctx.closePath();
      ctx.fillStyle = slices[i].color || '#f4a340';
      ctx.fill();
      // label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1a1030';
      ctx.font = 'bold 13px system-ui, sans-serif';
      const text = `${slices[i].emoji || ''} ${slices[i].label}`.trim();
      ctx.fillText(text.length > 14 ? text.slice(0, 13) + '…' : text, r - 10, 5);
      ctx.restore();
    }
    // pointer (top)
    ctx.beginPath();
    ctx.moveTo(cx - 12, 2);
    ctx.lineTo(cx + 12, 2);
    ctx.lineTo(cx, 26);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  // Spin so that `targetIndex` ends under the top pointer. Returns a Promise.
  function spinTo(canvas, slices, targetIndex, opts = {}) {
    const n = slices.length;
    const arc = (2 * Math.PI) / n;
    const duration = opts.duration || 4200;
    const turns = opts.turns || 5;
    // Angle of slice center i (before rotation) is i*arc + arc/2, measured from +x axis.
    // The pointer sits at the top = -PI/2. Solve final rotation so target center hits pointer.
    const targetCenter = targetIndex * arc + arc / 2;
    const finalRotation = turns * 2 * Math.PI + (-Math.PI / 2 - targetCenter);
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    return new Promise((resolve) => {
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        drawWheel(canvas, slices, finalRotation * easeOut(t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  window.Wheel = { drawWheel, spinTo };
})();
```

- [ ] **Step 2: Verify rendering in isolation**

Temporarily, in the browser console at `http://localhost:3000/`, run:
```js
const c = document.getElementById('wheel');
const s = (await (await fetch('/api/config')).json()).slices;
Wheel.drawWheel(c, s, 0);
```
Expected: a colored wheel with labels and a white pointer draws on the canvas. Then:
```js
await Wheel.spinTo(c, s, 0);
```
Expected: the wheel spins and eases to a stop with slice index 0's label under the top pointer.

- [ ] **Step 3: Commit**

```bash
git add public/wheel.js
git commit -m "feat: add canvas wheel rendering and spin animation"
```

---

## Task 13: Player flow controller (`public/player.js`)

**Files:**
- Create: `public/player.js`

- [ ] **Step 1: Create `public/player.js`**

```js
(function () {
  const qs = (id) => document.getElementById(id);
  const screens = ['welcome','unlock','wheel','prize','review','feedback','lead','done'];
  function show(name) {
    screens.forEach((s) => qs('screen-' + s).classList.toggle('active', s === name));
  }

  // Stable per-device id (best-effort anti-replay; the daily code is the real gate).
  function deviceId() {
    let id = localStorage.getItem('bt_device');
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bt_device', id); }
    return id;
  }

  const params = new URLSearchParams(location.search);
  const KIOSK = params.get('mode') === 'kiosk';

  let config = null;
  let lastPlay = null;

  async function loadConfig() {
    config = await (await fetch('/api/config')).json();
    if (config.logoUrl) { const l = qs('logo'); l.src = config.logoUrl; l.hidden = false; }
    qs('title').textContent = 'Spin to win! 🌮';
    Wheel.drawWheel(qs('wheel'), config.slices, 0);
  }

  async function doPlay(code) {
    const res = await fetch('/api/play', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId: deviceId() }),
    });
    if (res.status === 403) { qs('code-error').hidden = false; return null; }
    if (!res.ok) { alert('Something went wrong. Please try again.'); return null; }
    return res.json();
  }

  async function runSpin(play) {
    lastPlay = play;
    show('wheel');
    qs('btn-spin').disabled = true;
    await Wheel.spinTo(qs('wheel'), config.slices, play.winningIndex);
    qs('btn-spin').disabled = false;
    showPrize(play);
  }

  let countdownTimer = null;
  function showPrize(play) {
    qs('prize-label').textContent = `${play.prize.emoji || ''} ${play.prize.label}`.trim();
    qs('win-code').textContent = play.winCode;
    show('prize');
    clearInterval(countdownTimer);
    const end = new Date(play.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      qs('countdown').textContent = left > 0 ? `Expires in ${m}:${s}` : 'Expired — ask your server';
      if (left <= 0) clearInterval(countdownTimer);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // --- wiring ---
  qs('btn-start').addEventListener('click', () => show(KIOSK ? 'wheel' : 'unlock'));

  qs('btn-unlock').addEventListener('click', async () => {
    qs('code-error').hidden = true;
    const play = await doPlay(qs('code-input').value);
    if (play) {
      if (play.alreadyPlayed) { showPrize(play); }   // re-show existing prize
      else await runSpin(play);
    }
  });

  qs('btn-spin').addEventListener('click', async () => {
    // In kiosk mode there is no code screen; the code is provided via the button flow (Phase 2).
    if (lastPlay) return; // already spun
    if (KIOSK) {
      const play = await doPlay(window.__KIOSK_CODE__ || '');
      if (play && !play.alreadyPlayed) await runSpin(play);
    }
  });

  qs('btn-to-review').addEventListener('click', () => show('review'));

  qs('btn-up').addEventListener('click', async () => {
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentiment: 'up' }) });
    if (config.googleReviewUrl) window.location.href = config.googleReviewUrl;
    else show('lead');
  });

  qs('btn-down').addEventListener('click', () => show('feedback'));
  qs('btn-skip-review').addEventListener('click', () => show('lead'));

  qs('btn-send-feedback').addEventListener('click', async () => {
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentiment: 'down', text: qs('feedback-text').value }) });
    show('lead');
  });

  qs('btn-save-lead').addEventListener('click', async () => {
    const email = qs('lead-email').value.trim();
    if (email) await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    show('done');
  });
  qs('btn-skip-lead').addEventListener('click', () => show('done'));

  loadConfig();
  show('welcome');
})();
```

- [ ] **Step 2: Full manual walkthrough (phone mode)**

With the server running, open `http://localhost:3000/`. Get today's code from the admin API:
```bash
curl -H "x-admin-password: changeme" http://localhost:3000/api/admin/code
```
Then: Start → enter the code → wheel spins → prize + countdown shows → Next → 👎 → feedback → Send → email screen → skip → Done.
Expected: each transition works; entering a wrong code shows the red error; refreshing and entering the code again shows "already played" (same prize) instead of a new spin.

- [ ] **Step 3: Verify the thumbs-up path**

Set a real Google review URL first (or a placeholder like `https://example.com`) via the settings endpoint:
```bash
curl -X PUT -H "x-admin-password: changeme" -H "Content-Type: application/json" \
  -d '{"google_review_url":"https://example.com"}' http://localhost:3000/api/admin/settings
```
Reload the player page (config is fetched on load). Complete a spin, tap Next, then 👍.
Expected: clicking 👍 logs an `up` feedback row and navigates to the review URL.

- [ ] **Step 4: Commit**

```bash
git add public/player.js
git commit -m "feat: add player flow controller with kiosk-mode hook"
```

---

## Task 14: Admin page (`public/admin.html`, `public/admin.js`)

**Files:**
- Create: `public/admin.html`, `public/admin.js`

- [ ] **Step 1: Create `public/admin.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BON TACOS — Admin</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main id="app" style="max-width:720px;text-align:left">
    <section id="login" class="screen active">
      <h2>Admin login</h2>
      <input id="pw" type="password" placeholder="Admin password" />
      <button id="btn-login" class="primary">Enter</button>
      <p id="login-error" class="error" hidden>Wrong password.</p>
    </section>

    <section id="panel" class="screen">
      <h2>Today's code</h2>
      <div id="code" class="win-code" style="text-align:center"></div>
      <button id="btn-rotate" class="primary">New code now</button>

      <h2 style="margin-top:28px">Settings</h2>
      <label>Restaurant name<input id="set-name" /></label>
      <label>Google review URL<input id="set-review" placeholder="https://..." /></label>
      <label>Logo URL (optional)<input id="set-logo" placeholder="https://..." /></label>
      <button id="btn-save-settings" class="primary">Save settings</button>

      <h2 style="margin-top:28px">Prizes</h2>
      <table id="prizes" style="width:100%;border-collapse:collapse"></table>
      <button id="btn-add" class="primary" style="margin-top:12px">Add prize</button>

      <h2 style="margin-top:28px">Stats (last 30 days)</h2>
      <div id="stats"></div>

      <h2 style="margin-top:28px">Feedback</h2>
      <button id="btn-csv" class="primary">Download CSV</button>
      <div id="feedback"></div>
    </section>
  </main>
  <script src="admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `public/admin.js`**

```js
(function () {
  const qs = (id) => document.getElementById(id);
  let PW = '';
  const api = (path, opts = {}) =>
    fetch('/api/admin' + path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-password': PW, ...(opts.headers || {}) } });

  async function loadCode() { qs('code').textContent = (await (await api('/code')).json()).code; }

  async function loadSettings() {
    const s = await (await api('/settings')).json();
    qs('set-name').value = s.name || '';
    qs('set-review').value = s.google_review_url || '';
    qs('set-logo').value = s.logo_url || '';
  }

  async function loadPrizes() {
    const prizes = await (await api('/prizes')).json();
    const rows = prizes.map((p) => `
      <tr data-id="${p.id}">
        <td><input value="${p.label}" data-f="label" style="margin:4px"/></td>
        <td><input value="${p.emoji || ''}" data-f="emoji" style="width:48px;margin:4px"/></td>
        <td><input value="${p.color}" data-f="color" style="width:80px;margin:4px"/></td>
        <td><input type="number" value="${p.weight}" data-f="weight" style="width:64px;margin:4px"/></td>
        <td><input type="number" value="${p.daily_cap ?? ''}" data-f="daily_cap" placeholder="∞" style="width:64px;margin:4px"/></td>
        <td><button data-act="save">Save</button> <button data-act="del">✕</button></td>
      </tr>`).join('');
    qs('prizes').innerHTML =
      '<tr><th>Label</th><th>Emoji</th><th>Color</th><th>Weight</th><th>Cap</th><th></th></tr>' + rows;
  }

  async function loadStats() {
    const s = await (await api('/stats')).json();
    qs('stats').innerHTML =
      `<p>Plays: <b>${s.plays}</b> · 👍 ${s.thumbsUp} · 👎 ${s.thumbsDown} · Leads ${s.leads}</p>` +
      '<ul>' + s.winsByPrize.map((w) => `<li>${w.label}: ${w.n}</li>`).join('') + '</ul>';
  }

  async function loadFeedback() {
    const f = await (await api('/feedback')).json();
    qs('feedback').innerHTML = '<ul>' + f.slice(0, 50).map((r) =>
      `<li>${r.created_at.slice(0, 16)} — <b>${r.kind}</b> ${r.text || r.email || r.phone || ''}</li>`).join('') + '</ul>';
  }

  function rowPayload(tr) {
    const p = {};
    tr.querySelectorAll('input[data-f]').forEach((i) => {
      const f = i.dataset.f;
      if (f === 'weight') p[f] = parseInt(i.value, 10) || 0;
      else if (f === 'daily_cap') p[f] = i.value === '' ? null : parseInt(i.value, 10);
      else p[f] = i.value;
    });
    return p;
  }

  qs('btn-login').addEventListener('click', async () => {
    PW = qs('pw').value;
    const res = await api('/code');
    if (res.status === 401) { qs('login-error').hidden = false; return; }
    qs('login').classList.remove('active');
    qs('panel').classList.add('active');
    await loadCode(); await loadSettings(); await loadPrizes(); await loadStats(); await loadFeedback();
  });

  qs('btn-rotate').addEventListener('click', async () => { await api('/code/rotate', { method: 'POST' }); await loadCode(); });

  qs('btn-save-settings').addEventListener('click', async () => {
    await api('/settings', { method: 'PUT', body: JSON.stringify({
      name: qs('set-name').value,
      google_review_url: qs('set-review').value,
      logo_url: qs('set-logo').value,
    }) });
    alert('Settings saved.');
  });

  qs('btn-add').addEventListener('click', async () => {
    await api('/prizes', { method: 'POST', body: JSON.stringify({ label: 'New prize', emoji: '🎁', color: '#f4a340', weight: 5, daily_cap: null }) });
    await loadPrizes();
  });

  qs('prizes').addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const tr = e.target.closest('tr'); const id = tr.dataset.id;
    if (btn.dataset.act === 'save') { await api('/prizes/' + id, { method: 'PUT', body: JSON.stringify(rowPayload(tr)) }); await loadStats(); }
    if (btn.dataset.act === 'del') { await api('/prizes/' + id, { method: 'DELETE' }); await loadPrizes(); }
  });

  qs('btn-csv').addEventListener('click', async () => {
    const res = await api('/feedback.csv');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bontacos-feedback.csv';
    a.click();
  });
})();
```

- [ ] **Step 3: Manual verification**

Open `http://localhost:3000/admin.html`. Log in with `changeme`.
Expected: today's code shows; "New code now" changes it; Settings loads the name/review URL/logo and "Save settings" persists them (reload to confirm); the prizes table lists starter prizes and lets you edit weight/cap and Save; Add creates a row; Stats shows numbers (after you've done a play or two); Download CSV downloads a file.

- [ ] **Step 4: Commit**

```bash
git add public/admin.html public/admin.js
git commit -m "feat: add admin page (code, prizes, stats, feedback CSV)"
```

---

## Task 15: README + QR link, and end-to-end verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# BON TACOS — QR Fortune Wheel (Phase 1)

Local web app: scan a QR → enter the daily code → spin a weighted wheel → win a prize
→ optional Google review / private feedback. See the spec in
`docs/superpowers/specs/2026-08-25-qr-fortune-wheel-reviews-design.md`.

## Run locally

```bash
npm install
npm start
```

- Player page: http://localhost:3000/
- Admin page:  http://localhost:3000/admin.html  (default password `changeme` — set `ADMIN_PASSWORD` env var to change)

## Daily code

The unlock code rotates daily. Staff read today's code off the admin page.
Customers must enter it before they can spin.

## Prizes & odds

Edit prizes, weights (odds), and daily caps in the admin page. Weight is relative
(a weight-40 prize is awarded ~20× as often as a weight-2 prize). A daily cap stops
a prize once it's been awarded N times that day.

## QR code

Point the QR at the player URL (locally `http://localhost:3000/`; in production the
public URL). Generate one at any QR site, or with:

```bash
npx qrcode "http://localhost:3000/" -o qr.png
```

## Tests

```bash
npm test
```

## Phase 2 (later)

The player page supports `?mode=kiosk` for a mounted tablet + physical button.
Button hardware is specced separately when Phase 2 begins.
```

- [ ] **Step 2: Run the full test suite one more time**

Run: `npm test`
Expected: every test file passes.

- [ ] **Step 3: End-to-end manual smoke test (the acceptance check)**

With `npm start` running, verify each spec requirement:
1. Get today's code from `/admin.html`. 
2. Player: Start → wrong code shows error → correct code spins the wheel.
3. Prize screen shows a prize, a 6-char code, and a live countdown.
4. Refresh + re-enter code → "already played" re-shows the same prize (no new spin).
5. 👍 logs feedback + redirects to the review URL; 👎 → feedback form → Send logs it.
6. Admin: change a prize weight to 0 and Save → that prize never appears across ~20 plays (use a fresh `bt_device` each time via a private window or `localStorage.clear()`).
7. Admin: set a prize's cap to 1 → it's awarded at most once/day.
8. Admin stats reflect the plays; CSV downloads.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README and run instructions"
```

- [ ] **Step 5: Push Phase 1**

```bash
git push
```

---

## Notes for the implementer

- **Order matters:** `server/app.js` (Task 6) imports the play/feedback/admin routers created in Tasks 7–9. Follow the temporary-comment note in Task 6 if you run its test before those files exist; otherwise just implement Tasks 6–9 together and run `npm test` at the end of Task 9.
- **The phone is dumb:** never move prize selection or the "already played" check into `public/`. The server decides everything.
- **Compliance:** the review ask must always show *both* 👍 and 👎, and the prize must never depend on the answer. Do not change this.
- **Not in Phase 1 (YAGNI):** email/SMS coupon *sending*, unique-code redeem marking by staff, TripAdvisor, multi-restaurant/tenancy, hosting/deploy. The schema (`redeemed` column, `lead` rows, single `restaurant` row) leaves room for these without a rewrite.
- **Offline play is intentionally NOT in Phase 1.** The spec lists offline as an edge case "especially" for the Phase 2 tablet. Because the server is the source of truth for prize selection and the replay guard, the phone must reach the server to spin — offline caching would contradict "the phone is dumb." Offline handling is deferred to Phase 2 (the mounted tablet), where a cached prize set + later sync makes sense.
```
