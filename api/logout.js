const L = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Set-Cookie', L.sessionCookie(req, '', 0));
  L.json(res, 200, { ok: true });
};
