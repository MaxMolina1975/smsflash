const L = require('./_lib');

module.exports = async (req, res) => {
  if (!L.isAuthed(req)) return L.json(res, 401, { ok: false });
  if (!L.gateReady()) return L.json(res, 200, { ok: false, detail: 'Faltan SMSGATE_USER y SMSGATE_PASS en Vercel' });
  try {
    const r = await L.gate('/devices', 'GET');
    if (r.status === 401 || r.status === 403) return L.json(res, 200, { ok: false, detail: 'Usuario o contraseña del gateway incorrectos. Deben ser los de Cloud Server, no los de Local Server. ' + L.gateHint() });
    if (r.status >= 200 && r.status < 300) {
      let list = null;
      try { list = await r.json(); } catch {}
      if (Array.isArray(list) && list.length === 0) return L.json(res, 200, { ok: false, detail: 'No hay celulares registrados en la nube' });
      return L.json(res, 200, { ok: true, detail: 'Conectado' });
    }
    if (r.status === 404) return L.json(res, 200, { ok: true, detail: 'Conectado' });
    L.json(res, 200, { ok: false, detail: `Respuesta inesperada del gateway (${r.status})` });
  } catch (e) {
    L.json(res, 200, { ok: false, detail: L.friendly(e) });
  }
};
