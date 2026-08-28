// Static demo engine — the whole game runs client-side (no server).
// Shipped as api.js in the GitHub Pages build. Same interface as the live api.js.
(function () {
  // Edit prizes/odds here for the demo. weight = relative odds (higher = more common).
  const CONFIG = {
    name: 'BON TACOS',
    googleReviewUrl: '', // leave empty for the demo so 👍 stays in the app; set the real URL in production
    // Order MUST match the wheel segment angles in player.js (THETA).
    slices: [
      { id: 1, label: '10% off',      emoji: '🎟️', color: '#f9be1e', weight: 35 }, // ticket
      { id: 2, label: 'Free drink',   emoji: '🥤', color: '#ed1c24', weight: 22 }, // cup
      { id: 3, label: 'Free fries',   emoji: '🍟', color: '#f47a20', weight: 15 }, // fries
      { id: 4, label: 'Free nachos',  emoji: '🧀', color: '#2f2620', weight: 15 }, // nachos
      { id: 5, label: 'Mystery gift', emoji: '🎁', color: '#ed1c24', weight: 8 },  // gift
      { id: 6, label: 'Free meal',    emoji: '🌮', color: '#f9be1e', weight: 5 },  // coins
    ],
  };

  function demoCode() {
    const words = ['TACO', 'SALSA', 'NACHO', 'QUESO', 'FIESTA'];
    const d = new Date();
    const seed = d.getFullYear() * 372 + (d.getMonth() + 1) * 31 + d.getDate();
    return words[seed % words.length] + String(10 + (seed % 90));
  }
  function genWinCode() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += c[(Math.random() * c.length) | 0];
    return s;
  }
  function selectPrize(slices) {
    const total = slices.reduce((a, p) => a + p.weight, 0);
    let r = Math.random() * total;
    for (const p of slices) { r -= p.weight; if (r < 0) return p; }
    return slices[slices.length - 1];
  }

  window.BTApi = {
    async getConfig() {
      const slices = CONFIG.slices.map((s) => ({ id: s.id, label: s.label, emoji: s.emoji, color: s.color }));
      return { name: CONFIG.name, googleReviewUrl: CONFIG.googleReviewUrl, slices, demo: { code: demoCode() } };
    },
    async play(code) {
      const expected = demoCode();
      if (!code || String(code).trim().toUpperCase() !== expected.toUpperCase()) {
        return { status: 403, body: { error: 'bad_code' } };
      }
      // Demo: allow repeat spins so the client can try it several times.
      const chosen = selectPrize(CONFIG.slices);
      const idx = CONFIG.slices.findIndex((s) => s.id === chosen.id);
      return {
        status: 200,
        body: {
          alreadyPlayed: false,
          winningIndex: idx,
          prize: { id: chosen.id, label: chosen.label, emoji: chosen.emoji, color: chosen.color },
          winCode: genWinCode(),
          expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
        },
      };
    },
    async feedback() { return { status: 201 }; },
    async lead() { return { status: 201 }; },
  };
})();
