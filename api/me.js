const L = require('./_lib');

module.exports = async (req, res) => {
  if (!L.isAuthed(req)) return L.json(res, 401, { ok: false });
  L.json(res, 200, { ok: true, gateway: L.gateReady(), kv: !!L.kvCfg() });
};
