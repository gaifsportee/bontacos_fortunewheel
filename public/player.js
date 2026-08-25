(function () {
  const qs = (id) => document.getElementById(id);
  const screens = ['welcome','unlock','wheel','prize','review','feedback','lead','done'];
  function show(name) {
    screens.forEach((s) => qs('screen-' + s).classList.toggle('active', s === name));
  }

  // Stable per-device id (best-effort anti-replay; the daily code is the real gate).
  function deviceId() {
    let id = localStorage.getItem('bt_device');
    if (!id) { id = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bt_device', id); }
    return id;
  }

  const params = new URLSearchParams(location.search);
  const KIOSK = params.get('mode') === 'kiosk';

  let config = null;
  let lastPlay = null;

  async function loadConfig() {
    config = await (await fetch('/api/config')).json();
    if (config.logoUrl) { const l = qs('logo'); l.src = config.logoUrl; l.hidden = false; }
    qs('title').textContent = 'Spin to win! 🌮';
    Wheel.drawWheel(qs('wheel'), config.slices, 0);
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
    lastPlay = play;
    show('wheel');
    qs('btn-spin').disabled = true;
    await Wheel.spinTo(qs('wheel'), config.slices, play.winningIndex);
    qs('btn-spin').disabled = false;
    showPrize(play);
  }

  let countdownTimer = null;
  function showPrize(play) {
    qs('prize-label').textContent = `${play.prize.emoji || ''} ${play.prize.label}`.trim();
    qs('win-code').textContent = play.winCode;
    show('prize');
    clearInterval(countdownTimer);
    const end = new Date(play.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      qs('countdown').textContent = left > 0 ? `Expires in ${m}:${s}` : 'Expired — ask your server';
      if (left <= 0) clearInterval(countdownTimer);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  // --- wiring ---
  qs('btn-start').addEventListener('click', () => show(KIOSK ? 'wheel' : 'unlock'));

  qs('btn-unlock').addEventListener('click', async () => {
    qs('code-error').hidden = true;
    const play = await doPlay(qs('code-input').value);
    if (play) {
      if (play.alreadyPlayed) { showPrize(play); }   // re-show existing prize
      else await runSpin(play);
    }
  });

  qs('btn-spin').addEventListener('click', async () => {
    // In kiosk mode there is no code screen; the code is provided via the button flow (Phase 2).
    if (lastPlay) return; // already spun
    if (KIOSK) {
      const play = await doPlay(window.__KIOSK_CODE__ || '');
      if (play && !play.alreadyPlayed) await runSpin(play);
    }
  });

  qs('btn-to-review').addEventListener('click', () => show('review'));

  qs('btn-up').addEventListener('click', async () => {
    await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sentiment: 'up' }) });
    if (config.googleReviewUrl) window.location.href = config.googleReviewUrl;
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
