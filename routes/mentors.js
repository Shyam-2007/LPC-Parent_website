const express = require('express');
const { all, get, run } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { computeMatchScore } = require('../lib/matching');

const router = express.Router();

const TOP_N_SUGGESTIONS = 3;

function activeMenteeCount(mentorId) {
  return get(
    "SELECT COUNT(*) AS n FROM matches WHERE mentor_id = ? AND status = 'accepted'",
    [mentorId]
  ).n;
}

function getOrCreateDirectConversation(mentorId, menteeId, matchId) {
  const existing = get('SELECT id FROM conversations WHERE type = ? AND match_id = ?', ['direct', matchId]);
  if (existing) return existing.id;
  const { lastInsertRowid: convId } = run(
    "INSERT INTO conversations (type, name, match_id) VALUES ('direct', NULL, ?)",
    [matchId]
  );
  run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [convId, mentorId]);
  run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [convId, menteeId]);
  return convId;
}

/** Generate up to TOP_N_SUGGESTIONS new 'suggested' matches for a mentee. */
function generateSuggestionsForMentee(menteeId) {
  const menteeProfile = get('SELECT * FROM profiles WHERE user_id = ?', [menteeId]);
  if (!menteeProfile) return [];

  const candidates = all(
    `SELECT u.id AS mentor_id, p.* FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.role = 'mentor' AND p.is_mentor_candidate = 1 AND p.accepting_mentees = 1`
  );

  const alreadyPaired = new Set(
    all('SELECT mentor_id FROM matches WHERE mentee_id = ?', [menteeId]).map((r) => r.mentor_id)
  );

  const scored = candidates
    .filter((c) => !alreadyPaired.has(c.mentor_id))
    .filter((c) => activeMenteeCount(c.mentor_id) < (c.max_mentees ?? 3))
    .map((mentorProfile) => {
      const { score, breakdown } = computeMatchScore(mentorProfile, menteeProfile, activeMenteeCount(mentorProfile.mentor_id));
      return { mentorProfile, score, breakdown };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N_SUGGESTIONS);

  const created = [];
  for (const s of scored) {
    const { lastInsertRowid } = run(
      `INSERT OR IGNORE INTO matches (mentor_id, mentee_id, score, breakdown, status) VALUES (?, ?, ?, ?, 'suggested')`,
      [s.mentorProfile.mentor_id, menteeId, s.score, JSON.stringify(s.breakdown)]
    );
    created.push(lastInsertRowid);
  }
  return created;
}

function hydrateMatch(m) {
  const mentor = get('SELECT id, first_name, last_name, email FROM users WHERE id = ?', [m.mentor_id]);
  const mentee = get('SELECT id, first_name, last_name, email FROM users WHERE id = ?', [m.mentee_id]);
  const conversation = m.status === 'accepted'
    ? get('SELECT id FROM conversations WHERE match_id = ?', [m.id])
    : null;
  return { ...m, mentor, mentee, conversationId: conversation?.id || null, breakdown: m.breakdown ? JSON.parse(m.breakdown) : null };
}

router.get('/mentors', requireAuth, (req, res) => {
  const user = req.session.user;

  if (user.role === 'student_parent') {
    const profile = get('SELECT * FROM profiles WHERE user_id = ?', [user.id]);
    const matches = all('SELECT * FROM matches WHERE mentee_id = ? ORDER BY score DESC', [user.id]).map(hydrateMatch);
    return res.render('mentors_mentee', { title: 'Find a Mentor', profile, matches });
  }

  if (user.role === 'mentor') {
    const matches = all('SELECT * FROM matches WHERE mentor_id = ? ORDER BY status ASC, score DESC', [user.id]).map(hydrateMatch);
    const profile = get('SELECT * FROM profiles WHERE user_id = ?', [user.id]);
    return res.render('mentors_mentor', { title: 'My Mentees', profile, matches });
  }

  // admin
  const matches = all('SELECT * FROM matches ORDER BY created_at DESC').map(hydrateMatch);
  const waitingMentees = all(
    `SELECT u.id, u.first_name, u.last_name FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.role = 'student_parent' AND p.wants_mentor = 1
       AND u.id NOT IN (SELECT mentee_id FROM matches WHERE status = 'accepted')`
  );
  res.render('mentors_admin', { title: 'Mentor Matching (Admin)', matches, waitingMentees });
});

router.post('/mentors/suggest', requireRole('student_parent'), (req, res) => {
  generateSuggestionsForMentee(req.session.user.id);
  res.redirect('/mentors');
});

router.post('/mentors/admin/run-all', requireRole('admin'), (req, res) => {
  const waiting = all(
    `SELECT u.id FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.role = 'student_parent' AND p.wants_mentor = 1
       AND u.id NOT IN (SELECT mentee_id FROM matches WHERE status = 'accepted')`
  );
  waiting.forEach((m) => generateSuggestionsForMentee(m.id));
  res.redirect('/mentors');
});

router.post('/mentors/matches/:id/accept', requireRole('student_parent'), (req, res) => {
  const match = get('SELECT * FROM matches WHERE id = ? AND mentee_id = ?', [req.params.id, req.session.user.id]);
  if (!match) return res.status(404).render('error', { title: 'Not found', message: 'Match not found.' });

  run("UPDATE matches SET status = 'accepted', decided_at = datetime('now') WHERE id = ?", [match.id]);
  run(
    "UPDATE matches SET status = 'declined', decided_at = datetime('now') WHERE mentee_id = ? AND id != ? AND status = 'suggested'",
    [req.session.user.id, match.id]
  );
  getOrCreateDirectConversation(match.mentor_id, match.mentee_id, match.id);
  res.redirect('/mentors');
});

router.post('/mentors/matches/:id/decline', requireAuth, (req, res) => {
  const match = get('SELECT * FROM matches WHERE id = ?', [req.params.id]);
  if (!match) return res.status(404).render('error', { title: 'Not found', message: 'Match not found.' });
  if (match.mentee_id !== req.session.user.id && req.session.user.role !== 'admin') {
    return res.status(403).render('error', { title: 'Not authorized', message: 'You cannot modify this match.' });
  }
  run("UPDATE matches SET status = 'declined', decided_at = datetime('now') WHERE id = ?", [match.id]);
  res.redirect('/mentors');
});

module.exports = router;
