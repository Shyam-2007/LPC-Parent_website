// Real-time chat over Socket.IO, authenticated against the same
// express-session cookie used by the rest of the site (see sessionStore.js)
// so a client can never claim to be a user it isn't.
const { Server } = require('socket.io');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const { store, secret } = require('./sessionStore');
const { get, run } = require('../db/db');

function setupSocket(httpServer) {
  const io = new Server(httpServer);

  io.use((socket, next) => {
    const rawCookie = socket.request.headers.cookie;
    if (!rawCookie) return next(new Error('unauthorized'));
    const parsed = cookie.parse(rawCookie);
    const raw = parsed['lpc.sid'];
    if (!raw) return next(new Error('unauthorized'));
    const sid = cookieParser.signedCookie(decodeURIComponent(raw), secret);
    if (!sid) return next(new Error('unauthorized'));
    store.get(sid, (err, session) => {
      if (err || !session || !session.user) return next(new Error('unauthorized'));
      socket.user = session.user;
      next();
    });
  });

  io.on('connection', (socket) => {
    socket.on('join', (conversationId) => {
      const isMember = get(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [conversationId, socket.user.id]
      );
      if (!isMember) return;
      socket.join(`conv:${conversationId}`);
    });

    socket.on('message', ({ conversationId, body }) => {
      const text = (body || '').trim();
      if (!text || text.length > 4000) return;
      const isMember = get(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [conversationId, socket.user.id]
      );
      if (!isMember) return;

      const { lastInsertRowid } = run(
        'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)',
        [conversationId, socket.user.id, text]
      );
      const message = get('SELECT * FROM messages WHERE id = ?', [lastInsertRowid]);
      io.to(`conv:${conversationId}`).emit('message', {
        ...message,
        sender_name: `${socket.user.first_name} ${socket.user.last_name}`,
        sender_id: socket.user.id,
      });
    });
  });

  return io;
}

module.exports = { setupSocket };
