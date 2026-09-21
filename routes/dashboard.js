const express = require('express');
const { all, get } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('landing', { title: 'Las Positas College Student Parent Hub' });
});

router.get('/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;
  const profile = get('SELECT * FROM profiles WHERE user_id = ?', [user.id]);

  const scholarshipCount = get('SELECT COUNT(*) AS n FROM scholarships').n;
  const daycareCount = get('SELECT COUNT(*) AS n FROM daycare_centers').n;
  const partneredCount = get("SELECT COUNT(*) AS n FROM daycare_centers WHERE outreach_status = 'partnered'").n;

  let matchSummary = null;
  if (user.role === 'student_parent') {
    matchSummary = {
      suggested: get("SELECT COUNT(*) AS n FROM matches WHERE mentee_id = ? AND status = 'suggested'", [user.id]).n,
      accepted: get("SELECT COUNT(*) AS n FROM matches WHERE mentee_id = ? AND status = 'accepted'", [user.id]).n,
    };
  } else if (user.role === 'mentor') {
    matchSummary = {
      accepted: get("SELECT COUNT(*) AS n FROM matches WHERE mentor_id = ? AND status = 'accepted'", [user.id]).n,
    };
  } else if (user.role === 'admin') {
    matchSummary = {
      waiting: get(
        `SELECT COUNT(*) AS n FROM users u JOIN profiles p ON p.user_id = u.id
         WHERE u.role = 'student_parent' AND p.wants_mentor = 1
           AND u.id NOT IN (SELECT mentee_id FROM matches WHERE status = 'accepted')`
      ).n,
      totalMentors: get("SELECT COUNT(*) AS n FROM users WHERE role = 'mentor'").n,
    };
  }

  const recentScholarships = all('SELECT * FROM scholarships ORDER BY created_at DESC LIMIT 3');

  res.render('dashboard', {
    title: 'Dashboard',
    profile,
    scholarshipCount,
    daycareCount,
    partneredCount,
    matchSummary,
    recentScholarships,
  });
});

module.exports = router;
