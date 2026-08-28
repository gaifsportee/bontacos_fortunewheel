// Builds the static GitHub Pages demo into ./docs from the shared public/ assets.
// The only difference from the live app is api.js (client-side engine, no server).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');
const docs = path.join(root, 'docs');

const SHARED = ['index.html', 'styles.css', 'wheel.js', 'player.js', 'confetti.js', 'sound.js', 'i18n.js'];

fs.mkdirSync(docs, { recursive: true });
fs.mkdirSync(path.join(docs, 'assets'), { recursive: true });

// Copy shared front-end files (everything except api.js and admin, which are server-only).
for (const f of SHARED) {
  fs.copyFileSync(path.join(pub, f), path.join(docs, f));
}
// Copy assets.
for (const a of fs.readdirSync(path.join(pub, 'assets'))) {
  fs.copyFileSync(path.join(pub, 'assets', a), path.join(docs, 'assets', a));
}
// Swap in the static engine as api.js.
fs.copyFileSync(path.join(__dirname, 'static-api.js'), path.join(docs, 'api.js'));

// Prevent Jekyll from touching the files on GitHub Pages.
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

console.log('Static demo built into docs/:', [...SHARED, 'api.js', 'assets/', '.nojekyll'].join(', '));
