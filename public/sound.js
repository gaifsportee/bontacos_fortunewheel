// Dependency-free spin sounds via WebAudio: per-slice "tick" and a win chime.
// Must be kicked off from a user gesture (the SPIN tap) — call Sound.enable() there.
(function () {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tick() {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = 1050 + Math.random() * 120;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.06);
  }

  function win() {
    if (muted) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const s = t + i * 0.1;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.3, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.4);
      o.connect(g).connect(c.destination);
      o.start(s); o.stop(s + 0.45);
    });
  }

  window.Sound = { enable: ac, tick, win, mute: (m) => { muted = m; } };
})();
