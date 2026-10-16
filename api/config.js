const L = require('./_lib');

// Público: solo dice qué formas de entrar están disponibles.
module.exports = async (req, res) => {
  L.json(res, 200, {
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    password: !!process.env.APP_PASSWORD,
  });
};
