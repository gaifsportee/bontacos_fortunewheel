// Street-food graffiti wheel, drawn on canvas. The disc (segments + grunge + labels
// + painted rim) is pre-rendered once to an offscreen canvas, then drawn rotated each
// frame for a smooth, textured spin. Pointer + hub are DOM overlays.
(function () {
  function shade(hex, f) {
    var c = (hex || '#ed1c24').replace('#', '');
    var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function isLight(hex) {
    var c = (hex || '#f9be1e').replace('#', '');
    var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
  }
  function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }

  // rough radial line (hand-drawn divider) from r0 to r1 at angle a
  function roughRadial(g, cx, cy, r0, r1, a, jitter, w) {
    g.lineWidth = w; g.lineCap = 'round';
    g.beginPath();
    var steps = 7;
    for (var s = 0; s <= steps; s++) {
      var t = s / steps, r = r0 + (r1 - r0) * t;
      var off = (jitter[s] - 0.5) * w * 1.4;
      var x = cx + r * Math.cos(a) + off * Math.cos(a + Math.PI / 2);
      var y = cy + r * Math.sin(a) + off * Math.sin(a + Math.PI / 2);
      if (s === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }

  function shortLabel(label) {
    var map = { '10% off': '10%', 'Free drink': 'DRINK', 'Free fries': 'FRIES',
      'Free nachos': 'NACHOS', 'Mystery gift': 'GIFT', 'Free meal': 'MEAL', 'Try again free': 'AGAIN' };
    if (map[label]) return map[label];
    return String(label).toUpperCase().split(' ').pop().slice(0, 8);
  }

  function build(slices, size) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d');
    var n = slices.length, arc = 2 * Math.PI / n, cx = size / 2, cy = size / 2;
    var R = size / 2 - size * 0.012;
    var rimW = size * 0.085;
    var Rin = R - rimW;
    var rnd = rng(9187);

    for (var i = 0; i < n; i++) {
      var a0 = -Math.PI / 2 + i * arc, a1 = a0 + arc;
      var col = slices[i].color || '#ed1c24';
      g.save();
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, Rin, a0, a1); g.closePath(); g.clip();
      // base gradient
      var grad = g.createRadialGradient(cx, cy, Rin * 0.12, cx, cy, Rin);
      grad.addColorStop(0, shade(col, 1.14)); grad.addColorStop(1, shade(col, 0.78));
      g.fillStyle = grad; g.fillRect(0, 0, size, size);
      // waffle cross-hatch
      g.globalAlpha = 0.055; g.strokeStyle = isLight(col) ? '#1a1613' : '#ffffff';
      g.lineWidth = Math.max(1, size * 0.005);
      for (var d = -size; d < size; d += size * 0.052) {
        g.beginPath(); g.moveTo(d, 0); g.lineTo(d + size, size); g.stroke();
        g.beginPath(); g.moveTo(d + size, 0); g.lineTo(d, size); g.stroke();
      }
      g.globalAlpha = 1;
      // grunge speckles
      for (var s = 0; s < 240; s++) {
        var rr = Rin * Math.sqrt(rnd()), aa = a0 + rnd() * arc;
        var x = cx + rr * Math.cos(aa), y = cy + rr * Math.sin(aa), sz = size * (0.0016 + rnd() * 0.006);
        g.globalAlpha = 0.04 + rnd() * 0.13; g.fillStyle = rnd() > 0.5 ? '#000' : '#fff';
        g.beginPath(); g.arc(x, y, sz, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
      g.restore();

      // label: emoji outer, short word inner (radial)
      g.save();
      g.translate(cx, cy); g.rotate(a0 + arc / 2);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = Math.round(size * 0.078) + 'px "Segoe UI Emoji", system-ui, sans-serif';
      g.fillText(slices[i].emoji || '', Rin * 0.78, 0);
      var lc = isLight(col) ? '#1a1613' : '#fff5ea';
      var oc = isLight(col) ? '#fff5ea' : '#1a1613';
      g.font = '700 ' + Math.round(size * 0.05) + 'px Anton, system-ui, sans-serif';
      g.lineJoin = 'round'; g.lineWidth = size * 0.014; g.strokeStyle = oc;
      g.strokeText(shortLabel(slices[i].label), Rin * 0.55, 0);
      g.fillStyle = lc; g.fillText(shortLabel(slices[i].label), Rin * 0.55, 0);
      g.restore();
    }

    // rough painted dividers
    g.strokeStyle = 'rgba(20,16,12,.9)';
    for (var b = 0; b < n; b++) {
      var a = -Math.PI / 2 + b * arc;
      var j = []; for (var k = 0; k < 8; k++) j.push(rnd());
      roughRadial(g, cx, cy, Rin * 0.02, Rin, a, j, size * 0.014);
    }

    // ===== rim =====
    // dark backing ring
    g.lineWidth = rimW * 1.06; g.strokeStyle = '#160f0b';
    g.beginPath(); g.arc(cx, cy, Rin + rimW / 2, 0, 6.283); g.stroke();
    // gold band with painterly variation
    var gg = g.createLinearGradient(0, cy - R, 0, cy + R);
    gg.addColorStop(0, '#ffd766'); gg.addColorStop(0.5, '#f6a81e'); gg.addColorStop(1, '#c1121a');
    g.lineWidth = rimW * 0.8; g.strokeStyle = gg;
    g.beginPath(); g.arc(cx, cy, Rin + rimW / 2, 0, 6.283); g.stroke();
    // red inner hairline
    g.lineWidth = Math.max(2, size * 0.006); g.strokeStyle = '#ed1c24';
    g.beginPath(); g.arc(cx, cy, Rin + rimW * 0.14, 0, 6.283); g.stroke();
    // hand-drawn bulbs
    var bulbs = n * 5, br = Rin + rimW / 2;
    for (var m = 0; m < bulbs; m++) {
      var ba = (m / bulbs) * 6.283 + 0.05 * (rnd() - 0.5);
      var bx = cx + br * Math.cos(ba), by = cy + br * Math.sin(ba), rad = rimW * (0.17 + rnd() * 0.05);
      g.beginPath(); g.arc(bx, by, rad, 0, 6.283); g.fillStyle = '#160f0b'; g.fill();
      g.beginPath(); g.arc(bx, by, rad * 0.72, 0, 6.283); g.fillStyle = m % 2 ? '#fff3c4' : '#ffe07a'; g.fill();
    }
    return c;
  }

  function render(ctx, disc, rotation, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(rotation);
    ctx.drawImage(disc, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // Spin so winningIndex lands under the top pointer. Resolves with final rotation.
  function spinTo(canvas, disc, winningIndex, n, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), size = canvas.width;
    var arc = 2 * Math.PI / n;
    var onTick = opts.onTick || function () {};
    var turns = opts.turns || 6;
    var windupMs = opts.windupMs != null ? opts.windupMs : 550;
    var spinMs = opts.duration || 5200;
    var windup = 0.5, overshoot = arc * 0.32;
    var base = 2 * Math.PI * turns - (winningIndex * arc + arc / 2); // lands center at top
    var peak = base + overshoot, settleAt = 0.86, start = performance.now(), lastTick = 0;
    function q(t) { return 1 - Math.pow(1 - t, 5); }
    function c(t) { return 1 - Math.pow(1 - t, 3); }
    return new Promise(function (resolve) {
      function frame(now) {
        var el = now - start, rot;
        if (el < windupMs) rot = -windup * c(el / windupMs);
        else {
          var t = Math.min(1, (el - windupMs) / spinMs);
          if (t < settleAt) { var tt = t / settleAt; rot = -windup + (peak + windup) * q(tt); }
          else { var t2 = (t - settleAt) / (1 - settleAt); rot = peak + (base - peak) * c(t2); }
        }
        render(ctx, disc, rot, size);
        var b = Math.floor(rot / arc);
        if (b !== lastTick) { lastTick = b; onTick(); }
        if (el < windupMs + spinMs) requestAnimationFrame(frame);
        else { render(ctx, disc, base, size); resolve(base % (2 * Math.PI)); }
      }
      requestAnimationFrame(frame);
    });
  }

  window.Wheel = { build: build, render: render, spinTo: spinTo };
})();
