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
