// Renders a branded wheel and animates a dramatic spin: wind-up → long decelerating
// spin with per-slice ticks → overshoot & settle. Pointer + hub are DOM elements.
(function () {
  function isLight(hex) {
    const c = (hex || '#f9be1e').replace('#', '');
    const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
  }

  function drawWheel(canvas, slices, rotation, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const n = slices.length;
    const cx = size / 2, cy = size / 2;
    const rim = size * 0.045;
    const r = size / 2 - rim;
    const arc = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < n; i++) {
      const start = rotation + i * arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + arc);
      ctx.closePath();
      ctx.fillStyle = slices[i].color || '#f9be1e';
      ctx.fill();
      ctx.lineWidth = Math.max(2, size * 0.006);
      ctx.strokeStyle = 'rgba(26,22,19,.55)';
      ctx.stroke();
      // winner highlight overlay
      if (opts.highlight === i && opts.glow) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, start + arc);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${0.35 * opts.glow})`;
        ctx.fill();
        ctx.restore();
      }
      // label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = isLight(slices[i].color) ? '#1a1613' : '#fff5ea';
      const fs = Math.max(11, size * 0.052);
      ctx.font = `700 ${fs}px Poppins, system-ui, sans-serif`;
      const emoji = slices[i].emoji ? slices[i].emoji + ' ' : '';
      let text = (emoji + slices[i].label).trim();
      if (text.length > 15) text = text.slice(0, 14) + '…';
      ctx.fillText(text, r - size * 0.05, fs * 0.34);
      ctx.restore();
    }

    // winner outline
    if (opts.highlight != null && opts.glow) {
      const start = rotation + opts.highlight * arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + arc);
      ctx.closePath();
      ctx.lineWidth = Math.max(3, size * 0.014);
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * opts.glow})`;
      ctx.stroke();
    }

    // gold outer rim
    ctx.beginPath();
    ctx.arc(cx, cy, r + rim / 2, 0, 2 * Math.PI);
    ctx.lineWidth = rim;
    ctx.strokeStyle = '#f9be1e';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r + rim / 2, 0, 2 * Math.PI);
    ctx.lineWidth = Math.max(1, rim * 0.18);
    ctx.strokeStyle = 'rgba(193,18,26,.9)';
    ctx.stroke();
  }

  function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  // Which slice sits under the top pointer for a given rotation.
  function pointerSlice(rotation, n) {
    const arc = (2 * Math.PI) / n;
    let a = (-Math.PI / 2 - rotation) / arc - 0.5;
    let idx = Math.round(a) % n;
    if (idx < 0) idx += n;
    return idx;
  }

  // Spin from opts.fromRotation, land with targetIndex under the pointer.
  // Calls opts.onTick() each time a new slice passes under the pointer.
  // Resolves with the final resting rotation.
  function spinTo(canvas, slices, targetIndex, opts) {
    opts = opts || {};
    const n = slices.length;
    const arc = (2 * Math.PI) / n;
    const onTick = opts.onTick || function () {};
    const from = opts.fromRotation || 0;
    const windupMs = opts.windupMs != null ? opts.windupMs : 550;
    const spinMs = opts.duration || 5200;
    const turns = opts.turns || 8;
    const windupAmt = 0.45;                 // radians pulled backward first
    const overshoot = arc * 0.32;           // land slightly past, then settle

    // desired final rotation (mod 2π) so target center is under the pointer
    const desired = -Math.PI / 2 - (targetIndex * arc + arc / 2);
    let delta = ((desired - from) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const base = from + turns * 2 * Math.PI + delta; // absolute resting rotation
    const peak = base + overshoot;

    const settleAt = 0.86;
    const start = performance.now();
    let lastIdx = pointerSlice(from, n);

    return new Promise((resolve) => {
      function frame(now) {
        const el = now - start;
        let rot;
        if (el < windupMs) {
          rot = from - windupAmt * easeOutCubic(el / windupMs);
        } else {
          const t = Math.min(1, (el - windupMs) / spinMs);
          if (t < settleAt) {
            const tt = t / settleAt;
            rot = (from - windupAmt) + (peak - (from - windupAmt)) * easeOutQuint(tt);
          } else {
            const tt = (t - settleAt) / (1 - settleAt);
            rot = peak + (base - peak) * easeOutCubic(tt);
          }
        }
        drawWheel(canvas, slices, rot);
        const idx = pointerSlice(rot, n);
        if (idx !== lastIdx) { lastIdx = idx; onTick(); }

        const done = el >= windupMs + spinMs;
        if (!done) requestAnimationFrame(frame);
        else { drawWheel(canvas, slices, base); resolve(base % (2 * Math.PI)); }
      }
      requestAnimationFrame(frame);
    });
  }

  window.Wheel = { drawWheel, spinTo, easeOutCubic };
})();
