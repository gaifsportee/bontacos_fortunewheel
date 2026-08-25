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
