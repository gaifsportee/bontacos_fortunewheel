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
