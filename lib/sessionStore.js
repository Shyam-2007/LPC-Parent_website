// Shared session store + secret, used by both express-session (HTTP) and
// the Socket.IO auth middleware (lib/socket.js) so real-time chat can trust
// req.session.user instead of anything the client claims about itself.
//
// NOTE: MemoryStore does not persist across server restarts and does not
// scale beyond a single process. That's fine for a first deployment; if
// this grows past one server instance, swap in a persistent session store
// (e.g. a Redis or SQL-backed store) — see README "Scaling up" section.
const session = require('express-session');

const store = new session.MemoryStore();
const secret = process.env.SESSION_SECRET || 'lpc-parent-hub-dev-secret-change-me';

module.exports = { store, secret };
