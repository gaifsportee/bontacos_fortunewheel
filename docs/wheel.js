// Image-based wheel: rotates the inner disc element so a target segment lands
// under the fixed pointer baked into the static frame. Dramatic windup +
// decelerating spin + overshoot-and-settle, with a tick callback per segment.
(function () {
  var TICK_DEG = 60; // 6 segments

  function spin(disc, targetTheta, opts) {
    opts = opts || {};
    var onTick = opts.onTick || function () {};
    var turns = opts.turns || 6;
    var windupMs = opts.windupMs != null ? opts.windupMs : 550;
    var spinMs = opts.duration || 5200;
    var windupDeg = 26;         // pull back before launch
    var overshoot = 22;         // land a touch past, then settle
    var base = 360 * turns - (((targetTheta % 360) + 360) % 360); // clockwise resting angle
    var peak = base + overshoot;
    var settleAt = 0.86;
    var start = performance.now();
    var lastTick = 0;
    function q(t) { return 1 - Math.pow(1 - t, 5); }
    function c(t) { return 1 - Math.pow(1 - t, 3); }

    return new Promise(function (resolve) {
      function frame(now) {
        var el = now - start, rot;
        if (el < windupMs) {
          rot = -windupDeg * c(el / windupMs);
        } else {
          var t = Math.min(1, (el - windupMs) / spinMs);
          if (t < settleAt) {
            var tt = t / settleAt;
            rot = -windupDeg + (peak + windupDeg) * q(tt);
          } else {
            var t2 = (t - settleAt) / (1 - settleAt);
            rot = peak + (base - peak) * c(t2);
          }
        }
        disc.style.transform = 'rotate(' + rot + 'deg)';
        var b = Math.floor(rot / TICK_DEG);
        if (b !== lastTick) { lastTick = b; onTick(); }
        if (el < windupMs + spinMs) requestAnimationFrame(frame);
        else { disc.style.transform = 'rotate(' + base + 'deg)'; resolve(base % 360); }
      }
      requestAnimationFrame(frame);
    });
  }

  function reset(disc) { disc.style.transform = 'rotate(0deg)'; }

  window.Wheel = { spin: spin, reset: reset };
})();
