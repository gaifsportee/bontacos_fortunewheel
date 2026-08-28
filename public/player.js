(function () {
  var qs = function (id) { return document.getElementById(id); };
  var screens = ['welcome','unlock','wheel','prize','review','feedback','lead','done'];

  function show(name) {
    screens.forEach(function (s) { qs('screen-' + s).classList.toggle('active', s === name); });
    var bg = name === 'unlock' ? 'unlock' : (name === 'done' ? 'done' : 'main');
    document.body.setAttribute('data-bg', bg);
    if (name === 'wheel') sizeWheel();
  }

  window.onLangChange = function () {
    if (!state.spinning) { var b = qs('btn-spin'); if (b) b.textContent = I18N.t('spin'); }
    var hint = qs('demo-hint'); if (hint && !hint.hidden) hint.textContent = I18N.t('demo_hint');
  };

  function deviceId() {
    var id = localStorage.getItem('bt_device');
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bt_device', id); }
    return id;
  }

  var params = new URLSearchParams(location.search);
  var KIOSK = params.get('mode') === 'kiosk';
  if (KIOSK) document.body.classList.add('kiosk');

  var state = { config: null, pendingPlay: null, spinning: false, disc: null, discSize: 0, rotation: 0, fontsReady: false };

  function sizeWheel() {
    if (!state.config || !window.Wheel) return;
    var wrap = document.querySelector('.wheel-wrap');
    var px = wrap.clientWidth || 320;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = Math.round(px * dpr);
    var canvas = qs('wheel');
    canvas.width = size; canvas.height = size;
    if (!state.disc || state.discSize !== size || state._rebuild) {
      state.disc = Wheel.build(state.config.slices, size);
      state.discSize = size; state._rebuild = false;
    }
    Wheel.render(canvas.getContext('2d'), state.disc, state.rotation, size);
  }

  window.addEventListener('resize', function () {
    if (qs('screen-wheel').classList.contains('active') && !state.spinning) sizeWheel();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      state.fontsReady = true; state._rebuild = true;
      if (qs('screen-wheel').classList.contains('active')) sizeWheel();
    });
  }

  async function loadConfig() {
    state.config = await BTApi.getConfig();
    document.title = (state.config.name || 'BON TACOS') + ' — Spin to Win';
    if (state.config.demo && state.config.demo.code) {
      qs('code-input').value = state.config.demo.code;
      var hint = qs('demo-hint');
      if (hint) { hint.textContent = I18N.t('demo_hint'); hint.hidden = false; }
    }
  }

  async function doPlay(code) {
    var res = await BTApi.play(code, deviceId());
    if (res.status === 403) { qs('code-error').hidden = false; return null; }
    if (res.status !== 200 || !res.body) { alert('Something went wrong. Please try again.'); return null; }
    return res.body;
  }

  async function runSpin(play) {
    if (state.spinning) return;
    state.spinning = true;
    var btn = qs('btn-spin');
    btn.disabled = true; btn.textContent = I18N.t('spinning');
    if (window.Sound) Sound.enable();
    state.rotation = await Wheel.spinTo(qs('wheel'), state.disc, play.winningIndex, state.config.slices.length, {
      onTick: function () { if (window.Sound) Sound.tick(); },
    });
    if (window.Sound) Sound.win();
    var wrap = document.querySelector('.wheel-wrap');
    wrap.classList.add('win');
    await new Promise(function (r) { setTimeout(r, 900); });
    wrap.classList.remove('win');
    state.spinning = false;
    btn.disabled = false; btn.textContent = I18N.t('spin');
    showPrize(play);
  }

  var countdownTimer = null;
  function showPrize(play) {
    qs('prize-label').textContent = ((play.prize.emoji || '') + ' ' + play.prize.label).trim();
    qs('win-code').textContent = play.winCode;
    show('prize');
    if (window.Confetti) Confetti.burst();
    clearInterval(countdownTimer);
    var end = new Date(play.expiresAt).getTime();
    var el = qs('countdown');
    var tick = function () {
      var left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      var m = String(Math.floor(left / 60)).padStart(2, '0');
      var s = String(left % 60).padStart(2, '0');
      if (left > 0) { el.textContent = I18N.t('expires_in') + ' ' + m + ':' + s; el.classList.remove('expired'); }
      else { el.textContent = I18N.t('expired'); el.classList.add('expired'); clearInterval(countdownTimer); }
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // --- wiring ---
  qs('btn-start').addEventListener('click', function () { state.rotation = 0; show(KIOSK ? 'wheel' : 'unlock'); });

  qs('btn-unlock').addEventListener('click', async function () {
    qs('code-error').hidden = true;
    var play = await doPlay(qs('code-input').value);
    if (!play) return;
    state.pendingPlay = play;
    state.rotation = 0;
    show('wheel');
  });

  qs('code-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') qs('btn-unlock').click(); });

  qs('btn-spin').addEventListener('click', async function () {
    if (state.spinning) return;
    var play = state.pendingPlay;
    if (!play && KIOSK) { play = await doPlay(window.__KIOSK_CODE__ || ''); if (!play) return; }
    if (!play) return;
    state.pendingPlay = null;
    await runSpin(play);
  });

  qs('btn-to-review').addEventListener('click', function () { show('review'); });

  qs('btn-up').addEventListener('click', async function () {
    await BTApi.feedback('up');
    if (state.config.googleReviewUrl) window.location.href = state.config.googleReviewUrl;
    else show('lead');
  });

  qs('btn-down').addEventListener('click', function () { show('feedback'); });
  qs('btn-skip-review').addEventListener('click', function () { show('lead'); });

  qs('btn-send-feedback').addEventListener('click', async function () {
    await BTApi.feedback('down', qs('feedback-text').value);
    show('lead');
  });

  qs('btn-save-lead').addEventListener('click', async function () {
    var email = qs('lead-email').value.trim();
    if (email) await BTApi.lead(email);
    show('done');
  });
  qs('btn-skip-lead').addEventListener('click', function () { show('done'); });

  if (window.I18N) I18N.init();
  loadConfig();
  show('welcome');
})();
