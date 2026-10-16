const L = require('./_lib');

const TOKENINFO = process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.json(res, 405, { ok: false });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!clientId || !allowed.length || !L.secret()) {
    return L.json(res, 500, { ok: false, error: 'Falta configurar GOOGLE_CLIENT_ID, ALLOWED_EMAILS y SESSION_SECRET en Vercel' });
  }
  const { credential } = await L.readJson(req);
  if (!credential) return L.json(res, 400, { ok: false, error: 'Falta la credencial de Google' });
  try {
    const r = await fetch(`${TOKENINFO}?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return L.json(res, 401, { ok: false, error: 'Google no validó la sesión' });
    const j = await r.json();
    const issOk = j.iss === 'accounts.google.com' || j.iss === 'https://accounts.google.com';
    const verified = j.email_verified === true || j.email_verified === 'true';
    const fresh = Number(j.exp) * 1000 > Date.now();
    const email = String(j.email || '').toLowerCase();
    if (j.aud !== clientId || !issOk || !verified || !fresh) {
      return L.json(res, 401, { ok: false, error: 'Credencial de Google inválida' });
    }
    if (!allowed.includes(email)) {
      return L.json(res, 403, { ok: false, error: 'Esta cuenta de Google no tiene acceso' });
    }
    const token = L.sign({ exp: Date.now() + 30 * L.DAY, email });
    res.setHeader('Set-Cookie', L.sessionCookie(req, token, 30 * 24 * 3600));
    L.json(res, 200, { ok: true, email });
  } catch (e) {
    L.json(res, 200, { ok: false, error: 'No se pudo contactar a Google' });
  }
};
