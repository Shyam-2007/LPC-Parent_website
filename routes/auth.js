const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../db/db');

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('register', { title: 'Join the Hub', error: null, form: {} });
});

router.post('/register', (req, res) => {
  const { email, password, confirm_password, first_name, last_name, role } = req.body;

  const errors = [];
  if (!email || !password || !first_name || !last_name || !role) errors.push('All fields are required.');
  if (password && password.length < 8) errors.push('Password must be at least 8 characters.');
  if (password !== confirm_password) errors.push('Passwords do not match.');
  if (!['student_parent', 'mentor'].includes(role)) errors.push('Please choose a valid account type.');

  if (errors.length) {
    return res.status(400).render('register', { title: 'Join the Hub', error: errors.join(' '), form: req.body });
  }

  const existing = get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing) {
    return res.status(400).render('register', { title: 'Join the Hub', error: 'An account with that email already exists.', form: req.body });
  }

  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid: userId } = run(
    'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
    [email.toLowerCase().trim(), hash, first_name.trim(), last_name.trim(), role]
  );

  run(
    `INSERT INTO profiles (user_id, wants_mentor, is_mentor_candidate, accepting_mentees)
     VALUES (?, ?, ?, ?)`,
    [userId, role === 'student_parent' ? 1 : 0, role === 'mentor' ? 1 : 0, 1]
  );

  // Auto-join the campus-wide community chat room.
  const community = get("SELECT id FROM conversations WHERE type = 'group' AND name = 'Community Chat'");
  if (community) {
    run('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [community.id, userId]);
  }

  req.session.user = { id: userId, email: email.toLowerCase().trim(), first_name, last_name, role };
  res.redirect('/profile/edit?welcome=1');
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { title: 'Log In', error: null, email: '' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = get('SELECT * FROM users WHERE email = ?', [(email || '').toLowerCase().trim()]);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(400).render('login', { title: 'Log In', error: 'Invalid email or password.', email });
  }
  req.session.user = { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, role: user.role };
  const dest = req.session.returnTo || '/dashboard';
  delete req.session.returnTo;
  res.redirect(dest);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
