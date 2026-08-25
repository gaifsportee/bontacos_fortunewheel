// Tiny dependency-free confetti burst in BON TACOS colors.
(function () {
  const colors = ['#f9be1e', '#f47a20', '#ed1c24', '#ffffff', '#c1121a'];
  let canvas, ctx, parts = [], raf = null;

  function ensure() {
    canvas = document.getElementById('confetti');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }
  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst() {
    if (!canvas) ensure();
    canvas.style.display = 'block';
    const W = window.innerWidth;
    for (let i = 0; i < 140; i++) {
      parts.push({
        x: W / 2 + (Math.random() - 0.5) * 120,
        y: window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 9,
        vy: Math.random() * -11 - 4,
        g: 0.28 + Math.random() * 0.15,
        s: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        c: colors[(Math.random() * colors.length) | 0],
        life: 0,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
      ctx.restore();
    });
    parts = parts.filter((p) => p.y < window.innerHeight + 40 && p.life < 260);
    if (parts.length) { raf = requestAnimationFrame(tick); }
    else { raf = null; canvas.style.display = 'none'; }
  }

  window.Confetti = { burst };
})();
