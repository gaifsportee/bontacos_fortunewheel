// Crisp modern prize wheel, drawn on canvas at high resolution. The disc
// (flat segments + glossy bulb rim + labels) is pre-rendered once to an offscreen
// canvas and drawn rotated each frame. Pointer + hub are DOM overlays.
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
  function shortLabel(label) {
    var map = { '10% off': '10% OFF', 'Free drink': 'DRINK', 'Free fries': 'FRIES',
      'Free nachos': 'NACHOS', 'Mystery gift': 'GIFT', 'Free meal': 'FREE MEAL', 'Try again free': 'AGAIN' };
    if (map[label]) return map[label];
    return String(label).toUpperCase();
  }

  function build(slices, size) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    var n = slices.length, arc = 2 * Math.PI / n, cx = size / 2, cy = size / 2;
    var R = size / 2 - size * 0.006;
    var rimW = size * 0.07;
    var Rin = R - rimW;

    // ---- segments (flat with subtle radial depth) ----
    for (var i = 0; i < n; i++) {
      var a0 = -Math.PI / 2 + i * arc, a1 = a0 + arc;
      var col = slices[i].color || '#ed1c24';
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, Rin, a0, a1); g.closePath();
      var grd = g.createRadialGradient(cx, cy, Rin * 0.12, cx, cy, Rin);
      grd.addColorStop(0, shade(col, 1.10)); grd.addColorStop(0.72, col); grd.addColorStop(1, shade(col, 0.85));
      g.fillStyle = grd; g.fill();
    }

    // ---- crisp dividers (thin gold seams) ----
    for (var d = 0; d < n; d++) {
      var a = -Math.PI / 2 + d * arc;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Rin * Math.cos(a), cy + Rin * Math.sin(a));
      g.lineWidth = size * 0.012; g.strokeStyle = 'rgba(20,15,11,.55)'; g.stroke();
      g.lineWidth = size * 0.004; g.strokeStyle = 'rgba(255,231,150,.9)'; g.stroke();
    }

    // ---- labels (emoji outer, bold label inner) ----
    for (var j = 0; j < n; j++) {
      var b0 = -Math.PI / 2 + j * arc;
      var col2 = slices[j].color || '#ed1c24';
      g.save();
      g.translate(cx, cy); g.rotate(b0 + arc / 2);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      // emoji
      g.font = Math.round(size * 0.072) + 'px "Segoe UI Emoji", system-ui, sans-serif';
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = size * 0.01; g.shadowOffsetY = size * 0.004;
      g.fillText(slices[j].emoji || '', Rin * 0.74, 0);
      // label
      g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = size * 0.008; g.shadowOffsetY = size * 0.003;
      g.font = '400 ' + Math.round(size * 0.05) + 'px Anton, system-ui, sans-serif';
      g.lineJoin = 'round';
      g.lineWidth = size * 0.007; g.strokeStyle = isLight(col2) ? 'rgba(255,245,234,.9)' : 'rgba(20,15,11,.85)';
      g.strokeText(shortLabel(slices[j].label), Rin * 0.50, 0);
      g.shadowColor = 'transparent';
      g.fillStyle = isLight(col2) ? '#1a1613' : '#fff5ea';
      g.fillText(shortLabel(slices[j].label), Rin * 0.50, 0);
      g.restore();
    }

    // ---- rim ----
    // outer dark edge
    g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.lineWidth = size * 0.012; g.strokeStyle = '#140d09'; g.stroke();
    // glossy gold band
    var gb = g.createLinearGradient(0, cy - R, 0, cy + R);
    gb.addColorStop(0, '#ffe38a'); gb.addColorStop(0.42, '#f6b81e'); gb.addColorStop(0.6, '#e79a12'); gb.addColorStop(1, '#b8760a');
    g.beginPath(); g.arc(cx, cy, Rin + rimW / 2, 0, 6.283); g.lineWidth = rimW; g.strokeStyle = gb; g.stroke();
    // inner dark edge
    g.beginPath(); g.arc(cx, cy, Rin + size * 0.004, 0, 6.283); g.lineWidth = size * 0.01; g.strokeStyle = '#140d09'; g.stroke();
    // top gloss highlight on rim
    g.save();
    g.beginPath(); g.arc(cx, cy, Rin + rimW / 2, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = rimW * 0.34;
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.stroke();
    g.restore();
    // bulbs
    var bulbs = n * 4, br = Rin + rimW / 2, rad = rimW * 0.2;
    for (var m = 0; m < bulbs; m++) {
      var ba = (m / bulbs) * 6.283 - Math.PI / 2;
      var bx = cx + br * Math.cos(ba), by = cy + br * Math.sin(ba);
      g.beginPath(); g.arc(bx, by, rad + size * 0.003, 0, 6.283); g.fillStyle = '#7a4d06'; g.fill();
      var bgl = g.createRadialGradient(bx - rad * 0.3, by - rad * 0.3, rad * 0.1, bx, by, rad);
      bgl.addColorStop(0, '#fffef2'); bgl.addColorStop(0.5, '#ffe9a3'); bgl.addColorStop(1, '#f4b41c');
      g.beginPath(); g.arc(bx, by, rad, 0, 6.283); g.fillStyle = bgl; g.fill();
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

  function spinTo(canvas, disc, winningIndex, n, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), size = canvas.width;
    var arc = 2 * Math.PI / n;
    var onTick = opts.onTick || function () {};
    var turns = opts.turns || 6;
    var windupMs = opts.windupMs != null ? opts.windupMs : 550;
    var spinMs = opts.duration || 5200;
    var windup = 0.5, overshoot = arc * 0.32;
    var base = 2 * Math.PI * turns - (winningIndex * arc + arc / 2);
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
