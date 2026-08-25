const { openDb } = require('./db');
const { createApp } = require('./app');

const db = openDb(); // data/app.db
const app = createApp(db, { adminPassword: process.env.ADMIN_PASSWORD || 'changeme' });
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`BON TACOS fortune wheel running: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin.html  (password: ${process.env.ADMIN_PASSWORD || 'changeme'})`);
});
