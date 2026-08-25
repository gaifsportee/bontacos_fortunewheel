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
