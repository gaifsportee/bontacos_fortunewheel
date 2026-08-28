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

// Order MUST match the wheel segment angles in public/player.js (THETA).
const STARTER_PRIZES = [
  { label: '10% off',      emoji: '🎟️', color: '#f9be1e', weight: 35, daily_cap: null }, // ticket
  { label: 'Free drink',   emoji: '🥤', color: '#ed1c24', weight: 22, daily_cap: null }, // cup
  { label: 'Free fries',   emoji: '🍟', color: '#f47a20', weight: 15, daily_cap: 25 },   // fries
  { label: 'Free nachos',  emoji: '🧀', color: '#2f2620', weight: 15, daily_cap: 25 },   // nachos
  { label: 'Mystery gift', emoji: '🎁', color: '#c1121a', weight: 8,  daily_cap: 12 },   // gift
  { label: 'Free meal',    emoji: '🌮', color: '#2f2620', weight: 5,  daily_cap: 3 },    // coins
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
