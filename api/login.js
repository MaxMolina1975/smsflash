const crypto = require('crypto');
const L = require('./_lib');

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.json(res, 405, { ok: false });
  if (!process.env.APP_PASSWORD) return L.json(res, 500, { ok: false, error: 'Falta configurar APP_PASSWORD en Vercel' });
  const { password } = await L.readJson(req);
  if (!crypto.timingSafeEqual(hash(password || ''), hash(process.env.APP_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 600));
    return L.json(res, 401, { ok: false, error: 'Contraseña incorrecta' });
  }
  const token = L.sign({ exp: Date.now() + 30 * L.DAY });
  res.setHeader('Set-Cookie', L.sessionCookie(req, token, 30 * 24 * 3600));
  L.json(res, 200, { ok: true });
};
