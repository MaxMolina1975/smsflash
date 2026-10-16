const L = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.json(res, 405, { ok: false });
  if (!L.isAuthed(req)) return L.json(res, 401, { ok: false, error: 'Sesión vencida' });
  if (!L.gateReady()) return L.json(res, 200, { ok: false, error: 'Faltan SMSGATE_USER y SMSGATE_PASS en Vercel' });
  const { to, message } = await L.readJson(req);
  if (!/^\+\d{8,15}$/.test(String(to || ''))) return L.json(res, 200, { ok: false, error: 'Número inválido' });
  const text = String(message || '');
  if (!text.trim() || text.length > 1000) return L.json(res, 200, { ok: false, error: 'Mensaje vacío o demasiado largo' });
  try {
    // API actual: POST /messages con textMessage. Si el servidor es viejo, cae al formato anterior.
    let r = await L.gate('/messages', 'POST', { textMessage: { text }, phoneNumbers: [to] });
    if (r.status === 404 || r.status === 405) {
      r = await L.gate('/message', 'POST', { message: text, phoneNumbers: [to] });
    }
    if (r.status >= 200 && r.status < 300) {
      let j = {};
      try { j = await r.json(); } catch {}
      return L.json(res, 200, { ok: true, id: j.id || null });
    }
    if (r.status === 401 || r.status === 403) return L.json(res, 200, { ok: false, error: 'Credenciales del gateway incorrectas' });
    const t = (await r.text()).slice(0, 160);
    L.json(res, 200, { ok: false, error: t || `HTTP ${r.status}` });
  } catch (e) {
    L.json(res, 200, { ok: false, error: L.friendly(e) });
  }
};
