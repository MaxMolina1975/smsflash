const crypto = require('crypto');
const L = require('./_lib');

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return L.json(res, 405, { ok: false });
  if (!L.isAuthed(req)) return L.json(res, 401, { ok: false, error: 'Sesión vencida' });
  const c = L.cleanCampaign(await L.readJson(req));
  if (!c.t) return L.json(res, 200, { ok: false, error: 'Falta el título' });
  const base = L.publicBase(req);

  if (L.kvCfg()) {
    try {
      let slug = '';
      for (let i = 0; i < 7; i++) slug += ALPHABET[crypto.randomInt(ALPHABET.length)];
      await L.kv(['SET', 'c:' + slug, JSON.stringify(c)]);
      return L.json(res, 200, { ok: true, link: `${base}/c/${slug}`, short: true });
    } catch (e) {
      return L.json(res, 200, { ok: false, error: 'No se pudo guardar en la base de datos: ' + e.message });
    }
  }
  // Sin base de datos: los datos viajan dentro del enlace (más largo).
  const d = Buffer.from(JSON.stringify(c)).toString('base64url');
  L.json(res, 200, { ok: true, link: `${base}/l?d=${d}`, short: false });
};
