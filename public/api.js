// Server-backed API client (used by the live Node app).
// The static GitHub Pages demo ships a different api.js with the same interface.
window.BTApi = {
  async getConfig() {
    return (await fetch('/api/config')).json();
  },
  async play(code, deviceId) {
    const res = await fetch('/api/play', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId }),
    });
    let body = null;
    try { body = await res.json(); } catch (e) { /* ignore */ }
    return { status: res.status, body };
  },
  async feedback(sentiment, text) {
    const res = await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentiment, text }),
    });
    return { status: res.status };
  },
  async lead(email, phone) {
    const res = await fetch('/api/lead', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phone }),
    });
    return { status: res.status };
  },
};
