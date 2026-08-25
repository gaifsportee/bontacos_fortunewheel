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
