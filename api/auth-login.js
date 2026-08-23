// Legacy entrypoint retained for hosts that discover files under `api/`.
// Keep it on the same DB-backed multi-user implementation as Express routes.
module.exports = require('./auth/login');
