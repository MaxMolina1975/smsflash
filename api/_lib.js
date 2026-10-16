const crypto = require('crypto');

const COOKIE = 'sms_session';
const DAY = 24 * 60 * 60 * 1000;

/* ---------- Sesión ---------- */
const secret = () =>
  process.env.SESSION_SECRET ||
  (process.env.APP_PASSWORD ? crypto.createHash('sha256').update('sms:' + process.env.APP_PASSWORD).digest('hex') : '');

function sign(payload) {
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  return p + '.' + s;
}

function verify(token) {
  if (!token || !secret()) return null;
  const [p, s] = String(token).split('.');
  if (!p || !s) return null;
  const expected = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  const a = Buffer.from(s), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString());
    return d.exp > Date.now() ? d : null;
  } catch { return null; }
}

function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}

const isAuthed = (req) => !!verify(cookies(req)[COOKIE]);

function sessionCookie(req, token, maxAgeSec) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}`;
}

/* ---------- HTTP ---------- */
function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = '';
  if (typeof req.body === 'string') raw = req.body;
  else for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function origin(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return `${proto}://${host}`;
}

// Dirección pública para los enlaces: siempre el dominio de producción, aunque la plataforma
// se haya abierto desde una URL de deploy (esas piden login de Vercel y no muestran vista previa).
function publicBase(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.trim().replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return origin(req);
}

/* ---------- Gateway SMS (nube) ---------- */
const gateBase = () => process.env.SMSGATE_BASE || 'https://api.sms-gate.app/3rdparty/v1';
// Limpia espacios o comillas que a veces quedan al pegar valores en Vercel.
const clean = (v) => String(v || '').trim().replace(/^["']+|["']+$/g, '').trim();
const gateUser = () => clean(process.env.SMSGATE_USER);
const gatePass = () => clean(process.env.SMSGATE_PASS);
const gateReady = () => !!(gateUser() && gatePass());

// Pista para diagnosticar sin exponer secretos: forma del usuario y largo de la contraseña.
function gateHint() {
  const u = gateUser(), p = gatePass();
  const mask = u.length > 2 ? `${u[0]}…${u[u.length - 1]}` : '…';
  return `Plataforma usa usuario "${mask}" (${u.length} caracteres) y contraseña de ${p.length} caracteres`;
}

async function gate(route, method, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(gateBase() + route, {
      method,
      signal: ctrl.signal,
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${gateUser()}:${gatePass()}`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally { clearTimeout(timer); }
}

function friendly(e) {
  if (e && e.name === 'AbortError') return 'El gateway no respondió a tiempo';
  return 'No se pudo conectar con el gateway SMS';
}

/* ---------- Base de datos opcional (Upstash Redis por REST) ---------- */
function kvCfg() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function kv(cmd) {
  const c = kvCfg();
  if (!c) throw new Error('Sin base de datos');
  const r = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

/* ---------- Campañas (páginas con vista previa) ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cleanCampaign(d) {
  const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const url = (v) => {
    try { const u = new URL(String(v || '').trim()); return /^https?:$/.test(u.protocol) ? u.toString() : ''; }
    catch { return ''; }
  };
  const pick = (a, b) => (d[a] !== undefined ? d[a] : d[b]);
  return {
    t: str(pick('title', 't'), 90),
    d: str(pick('description', 'd'), 200),
    i: url(pick('image', 'i')),
    u: url(pick('url', 'u')),
    b: str(pick('button', 'b'), 30) || 'Ver más',
    r: pick('redirect', 'r') ? 1 : 0,
  };
}

function landingHtml(c, pageUrl) {
  const t = esc(c.t || 'Mensaje');
  const d = esc(c.d || c.t || 'Mensaje');
  const redirect = c.r && c.u
    ? `<script>location.replace(${JSON.stringify(c.u).replace(/</g, '\\u003c')})</script>` : '';
  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${t}">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(pageUrl)}">
${c.i ? `<meta property="og:image" content="${esc(c.i)}">
<meta property="og:image:secure_url" content="${esc(c.i)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(c.i)}">` : '<meta name="twitter:card" content="summary">'}
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<style>
body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#000;background:#fff}
main{max-width:560px;margin:0 auto;padding:32px 24px}
img{width:100%;border-radius:8px;display:block;margin-bottom:24px}
h1{font-size:26px;line-height:1.2;margin:0 0 12px;letter-spacing:-.02em}
p{color:#555;margin:0 0 28px}
a{display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px}
</style>
</head><body><main>
${c.i ? `<img src="${esc(c.i)}" alt="">` : ''}
<h1>${t}</h1>
${d ? `<p>${d}</p>` : ''}
${c.u ? `<a href="${esc(c.u)}">${esc(c.b)}</a>` : ''}
</main>${redirect}</body></html>`;
}

module.exports = {
  COOKIE, DAY, secret, sign, verify, isAuthed, sessionCookie, json, readJson, origin, publicBase,
  gate, gateReady, gateHint, friendly, kv, kvCfg, esc, cleanCampaign, landingHtml,
};
