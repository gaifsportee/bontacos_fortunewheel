(function () {
  const qs = (id) => document.getElementById(id);
  let PW = '';
  const api = (path, opts = {}) =>
    fetch('/api/admin' + path, { ...opts, headers: { 'Content-Type': 'application/json', 'x-admin-password': PW, ...(opts.headers || {}) } });

  async function loadCode() { qs('code').textContent = (await (await api('/code')).json()).code; }

  async function loadSettings() {
    const s = await (await api('/settings')).json();
    qs('set-name').value = s.name || '';
    qs('set-review').value = s.google_review_url || '';
    qs('set-logo').value = s.logo_url || '';
  }

  async function loadPrizes() {
    const prizes = await (await api('/prizes')).json();
    const rows = prizes.map((p) => `
      <tr data-id="${p.id}">
        <td><input value="${p.label}" data-f="label" style="margin:4px"/></td>
        <td><input value="${p.emoji || ''}" data-f="emoji" style="width:48px;margin:4px"/></td>
        <td><input value="${p.color}" data-f="color" style="width:80px;margin:4px"/></td>
        <td><input type="number" value="${p.weight}" data-f="weight" style="width:64px;margin:4px"/></td>
        <td><input type="number" value="${p.daily_cap ?? ''}" data-f="daily_cap" placeholder="∞" style="width:64px;margin:4px"/></td>
        <td><button data-act="save">Save</button> <button data-act="del">✕</button></td>
      </tr>`).join('');
    qs('prizes').innerHTML =
      '<tr><th>Label</th><th>Emoji</th><th>Color</th><th>Weight</th><th>Cap</th><th></th></tr>' + rows;
  }

  async function loadStats() {
    const s = await (await api('/stats')).json();
    qs('stats').innerHTML =
      `<p>Plays: <b>${s.plays}</b> · 👍 ${s.thumbsUp} · 👎 ${s.thumbsDown} · Leads ${s.leads}</p>` +
      '<ul>' + s.winsByPrize.map((w) => `<li>${w.label}: ${w.n}</li>`).join('') + '</ul>';
  }

  async function loadFeedback() {
    const f = await (await api('/feedback')).json();
    qs('feedback').innerHTML = '<ul>' + f.slice(0, 50).map((r) =>
      `<li>${r.created_at.slice(0, 16)} — <b>${r.kind}</b> ${r.text || r.email || r.phone || ''}</li>`).join('') + '</ul>';
  }

  function rowPayload(tr) {
    const p = {};
    tr.querySelectorAll('input[data-f]').forEach((i) => {
      const f = i.dataset.f;
      if (f === 'weight') p[f] = parseInt(i.value, 10) || 0;
      else if (f === 'daily_cap') p[f] = i.value === '' ? null : parseInt(i.value, 10);
      else p[f] = i.value;
    });
    return p;
  }

  qs('btn-login').addEventListener('click', async () => {
    PW = qs('pw').value;
    const res = await api('/code');
    if (res.status === 401) { qs('login-error').hidden = false; return; }
    qs('login').classList.remove('active');
    qs('panel').classList.add('active');
    await loadCode(); await loadSettings(); await loadPrizes(); await loadStats(); await loadFeedback();
  });

  qs('btn-rotate').addEventListener('click', async () => { await api('/code/rotate', { method: 'POST' }); await loadCode(); });

  qs('btn-save-settings').addEventListener('click', async () => {
    await api('/settings', { method: 'PUT', body: JSON.stringify({
      name: qs('set-name').value,
      google_review_url: qs('set-review').value,
      logo_url: qs('set-logo').value,
    }) });
    alert('Settings saved.');
  });

  qs('btn-add').addEventListener('click', async () => {
    await api('/prizes', { method: 'POST', body: JSON.stringify({ label: 'New prize', emoji: '🎁', color: '#f4a340', weight: 5, daily_cap: null }) });
    await loadPrizes();
  });

  qs('prizes').addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const tr = e.target.closest('tr'); const id = tr.dataset.id;
    if (btn.dataset.act === 'save') { await api('/prizes/' + id, { method: 'PUT', body: JSON.stringify(rowPayload(tr)) }); await loadStats(); }
    if (btn.dataset.act === 'del') { await api('/prizes/' + id, { method: 'DELETE' }); await loadPrizes(); }
  });

  qs('btn-csv').addEventListener('click', async () => {
    const res = await api('/feedback.csv');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bontacos-feedback.csv';
    a.click();
  });
})();
