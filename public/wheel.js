// Renders a wheel on a canvas and animates a spin that lands on a target slice.
(function () {
  function drawWheel(canvas, slices, rotation) {
    const ctx = canvas.getContext('2d');
    const n = slices.length;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.min(cx, cy) - 6;
    const arc = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < n; i++) {
      const start = rotation + i * arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + arc);
      ctx.closePath();
      ctx.fillStyle = slices[i].color || '#f4a340';
      ctx.fill();
      // label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1a1030';
      ctx.font = 'bold 13px system-ui, sans-serif';
      const text = `${slices[i].emoji || ''} ${slices[i].label}`.trim();
      ctx.fillText(text.length > 14 ? text.slice(0, 13) + '…' : text, r - 10, 5);
      ctx.restore();
    }
    // pointer (top)
    ctx.beginPath();
    ctx.moveTo(cx - 12, 2);
    ctx.lineTo(cx + 12, 2);
    ctx.lineTo(cx, 26);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  // Spin so that `targetIndex` ends under the top pointer. Returns a Promise.
  function spinTo(canvas, slices, targetIndex, opts = {}) {
    const n = slices.length;
    const arc = (2 * Math.PI) / n;
    const duration = opts.duration || 4200;
    const turns = opts.turns || 5;
    // Angle of slice center i (before rotation) is i*arc + arc/2, measured from +x axis.
    // The pointer sits at the top = -PI/2. Solve final rotation so target center hits pointer.
    const targetCenter = targetIndex * arc + arc / 2;
    const finalRotation = turns * 2 * Math.PI + (-Math.PI / 2 - targetCenter);
    const start = performance.now();
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    return new Promise((resolve) => {
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        drawWheel(canvas, slices, finalRotation * easeOut(t));
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  window.Wheel = { drawWheel, spinTo };
})();
