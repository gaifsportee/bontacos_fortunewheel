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
