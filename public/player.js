(function () {
  const qs = (id) => document.getElementById(id);
  const screens = ['welcome','unlock','wheel','prize','review','feedback','lead','done'];
  function show(name) {
    screens.forEach((s) => qs('screen-' + s).classList.toggle('active', s === name));
    if (name === 'wheel') sizeWheel();
  }

  // Stable per-device id (best-effort anti-replay; the daily code is the real gate).
  function deviceId() {
    let id = localStorage.getItem('bt_device');
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bt_device', id); }
    return id;
  }

  const params = new URLSearchParams(location.search);
  const KIOSK = params.get('mode') === 'kiosk';
  if (KIOSK) document.body.classList.add('kiosk');

  const state = { config: null, pendingPlay: null, rotation: 0, spinning: false };

  function sizeWheel() {
    if (!state.config) return;
    const wrap = document.querySelector('.wheel-wrap');
    const px = wrap.clientWidth || 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = qs('wheel');
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    Wheel.drawWheel(canvas, state.config.slices, state.rotation);
  }
  window.addEventListener('resize', () => {
    if (qs('screen-wheel').classList.contains('active') && !state.spinning) sizeWheel();
  });

  async function loadConfig() {
    state.config = await (await fetch('/api/config')).json();
    document.title = (state.config.name || 'BON TACOS') + ' — Spin to Win';
  }

  async function doPlay(code) {
    const res = await fetch('/api/play', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId: deviceId() }),
    });
    if (res.status === 403) { qs('code-error').hidden = false; return null; }
    if (!res.ok) { alert('Something went wrong. Please try again.'); return null; }
    return res.json();
  }

  async function runSpin(play) {
    if (state.spinning) return;
    state.spinning = true;
    qs('btn-spin').disabled = true;
    const canvas = qs('wheel');
    state.rotation = await Wheel.spinTo(canvas, state.config.slices, play.winningIndex);
    state.spinning = false;
    qs('btn-spin').disabled = false;
    showPrize(play);
  }

  let countdownTimer = null;
  function showPrize(play) {
    qs('prize-label').textContent = `${play.prize.emoji || ''} ${play.prize.label}`.trim();
    qs('win-code').textContent = play.winCode;
    show('prize');
    if (window.Confetti) Confetti.burst();
    clearInterval(countdownTimer);
    const end = new Date(play.expiresAt).getTime();
    const el = qs('countdown');
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      if (left > 0) { el.textContent = `Expires in ${m}:${s}`; el.classList.remove('expired'); }
      else { el.textContent = 'Expired — ask your server'; el.classList.add('expired'); clearInterval(countdownTimer); }
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // --- wiring ---
  qs('btn-start').addEventListener('click', () => show(KIOSK ? 'wheel' : 'unlock'));

  qs('btn-unlock').addEventListener('click', async () => {
    qs('code-error').hidden = true;
    const play = await doPlay(qs('code-input').value);
    if (!play) return;
    if (play.alreadyPlayed) { showPrize(play); return; }
    state.pendingPlay = play;
    show('wheel'); // idle wheel drawn; customer taps SPIN
  });

  qs('code-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') qs('btn-unlock').click(); });

  qs('btn-spin').addEventListener('click', async () => {
    if (state.spinning) return;
    let play = state.pendingPlay;
    if (!play && KIOSK) {
      play = await doPlay(window.__KIOSK_CODE__ || '');
      if (!play) return;
      if (play.alreadyPlayed) { showPrize(play); return; }
    }
    if (!play) return;
    state.pendingPlay = null;
    await runSpin(play);
  });

  qs('btn-to-review').addEventListener('click', () => show('review'));

  qs('btn-up').addEventListener('click', async () => {
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentiment: 'up' }) });
    if (state.config.googleReviewUrl) window.location.href = state.config.googleReviewUrl;
    else show('lead');
  });

  qs('btn-down').addEventListener('click', () => show('feedback'));
  qs('btn-skip-review').addEventListener('click', () => show('lead'));

  qs('btn-send-feedback').addEventListener('click', async () => {
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentiment: 'down', text: qs('feedback-text').value }) });
    show('lead');
  });

  qs('btn-save-lead').addEventListener('click', async () => {
    const email = qs('lead-email').value.trim();
    if (email) await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    show('done');
  });
  qs('btn-skip-lead').addEventListener('click', () => show('done'));

  loadConfig();
  show('welcome');
})();
