const L = require('./_lib');

function page(res, code, html, cache) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(html);
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let c = null;
  let canonical = '';
  try {
    const slug = (url.searchParams.get('slug') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (slug) {
      const raw = await L.kv(['GET', 'c:' + slug]);
      if (raw) c = L.cleanCampaign(JSON.parse(raw));
      canonical = L.publicBase(req) + '/c/' + slug;
    } else if (url.searchParams.get('d')) {
      c = L.cleanCampaign(JSON.parse(Buffer.from(url.searchParams.get('d'), 'base64url').toString()));
      canonical = L.publicBase(req) + '/l?d=' + url.searchParams.get('d');
    }
  } catch (e) { c = null; }

  if (!c || !c.t) return page(res, 404, '<!DOCTYPE html><meta charset="utf-8"><title>No encontrado</title><p style="font:16px system-ui;padding:32px">Este enlace no existe o venció.</p>');
  page(res, 200, L.landingHtml(c, canonical), 'public, max-age=0, s-maxage=300');
};
