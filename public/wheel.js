// Renders a branded wheel on a canvas and animates a spin landing on a target slice.
// The pointer and center hub are DOM elements (crisp, static); the canvas only draws slices.
(function () {
  function isLight(hex) {
    const c = (hex || '#f9be1e').replace('#', '');
    const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150; // luminance
  }

  function drawWheel(canvas, slices, rotation) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width; // device pixels (square)
    const n = slices.length;
    const cx = size / 2, cy = size / 2;
    const rim = size * 0.045;
    const r = size / 2 - rim;
    const arc = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < n; i++) {
      const start = rotation + i * arc;
      // slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + arc);
      ctx.closePath();
      ctx.fillStyle = slices[i].color || '#f9be1e';
      ctx.fill();
      // separator
      ctx.lineWidth = Math.max(2, size * 0.006);
      ctx.strokeStyle = 'rgba(26,22,19,.55)';
      ctx.stroke();
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

  // Spin so that `targetIndex` ends under the top pointer. Resolves with the final rotation.
  function spinTo(canvas, slices, targetIndex, opts = {}) {
    const n = slices.length;
    const arc = (2 * Math.PI) / n;
    const duration = opts.duration || 4600;
    const turns = opts.turns || 6;
    const targetCenter = targetIndex * arc + arc / 2;
    const finalRotation = turns * 2 * Math.PI + (-Math.PI / 2 - targetCenter);
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    return new Promise((resolve) => {
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        drawWheel(canvas, slices, finalRotation * easeOut(t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve(finalRotation % (2 * Math.PI));
      }
      requestAnimationFrame(frame);
    });
  }

  window.Wheel = { drawWheel, spinTo };
})();
