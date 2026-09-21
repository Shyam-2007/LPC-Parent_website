const express = require('express');
const { all, get } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function conversationLabel(conv, currentUserId) {
  if (conv.type === 'group') return conv.name || 'Group Chat';
  const others = all(
    `SELECT u.first_name, u.last_name FROM conversation_participants cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.conversation_id = ? AND cp.user_id != ?`,
    [conv.id, currentUserId]
  );
  return others.map((o) => `${o.first_name} ${o.last_name}`).join(', ') || 'Direct message';
}

router.get('/chat', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const conversations = all(
    `SELECT c.* FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE cp.user_id = ?
     ORDER BY c.type ASC, c.id DESC`,
    [userId]
  ).map((c) => ({
    ...c,
    label: conversationLabel(c, userId),
    lastMessage: get('SELECT body, created_at FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1', [c.id]),
  }));
  res.render('chat_list', { title: 'Messages', conversations });
});

router.get('/chat/:id', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const conv = get('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
  const isMember = conv && get(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [conv.id, userId]
  );
  if (!conv || !isMember) {
    return res.status(404).render('error', { title: 'Not found', message: 'Conversation not found.' });
  }
  const messages = all(
    `SELECT m.*, u.first_name, u.last_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = ? ORDER BY m.id ASC`,
    [conv.id]
  );
  res.render('chat_room', {
    title: conversationLabel(conv, userId),
    conversation: conv,
    label: conversationLabel(conv, userId),
    messages,
  });
});

module.exports = router;
