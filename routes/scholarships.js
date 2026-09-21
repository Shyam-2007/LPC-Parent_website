const express = require('express');
const { all, get, run } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const TAG_LABELS = {
  student_parent: 'Student Parent',
  single_parent: 'Single Parent',
  calworks: 'CalWORKs',
  low_income: 'Low Income',
  women: 'Women',
  adult_learner: 'Adult Learner',
  transfer: 'Transfer',
  first_gen: 'First-Gen',
  general: 'General',
  childcare: 'Childcare',
};

router.get('/scholarships', requireAuth, (req, res) => {
  const tagFilter = (req.query.tag || '').trim();
  let rows = all('SELECT * FROM scholarships ORDER BY created_at DESC');
  if (tagFilter) {
    rows = rows.filter((r) => (r.eligibility_tags || '').split(',').map(t => t.trim()).includes(tagFilter));
  }
  const allTags = new Set();
  all('SELECT eligibility_tags FROM scholarships').forEach((r) => {
    (r.eligibility_tags || '').split(',').forEach((t) => t.trim() && allTags.add(t.trim()));
  });
  res.render('scholarships', {
    title: 'Scholarships & Support Programs',
    scholarships: rows,
    allTags: [...allTags].sort(),
    tagFilter,
    TAG_LABELS,
  });
});

router.get('/scholarships/new', requireRole('admin'), (req, res) => {
  res.render('scholarship_form', { title: 'Add Scholarship', scholarship: {}, error: null });
});

router.post('/scholarships/new', requireRole('admin'), (req, res) => {
  let { title, provider, description, amount, deadline, eligibility_tags, link } = req.body;
  if (!title) {
    return res.status(400).render('scholarship_form', { title: 'Add Scholarship', scholarship: req.body, error: 'Title is required.' });
  }
  provider = provider || ''; description = description || ''; amount = amount || '';
  deadline = deadline || ''; eligibility_tags = eligibility_tags || ''; link = link || '';
  run(
    `INSERT INTO scholarships (title, provider, description, amount, deadline, eligibility_tags, link, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, provider, description, amount, deadline, eligibility_tags, link, req.session.user.id]
  );
  res.redirect('/scholarships');
});

router.post('/scholarships/:id/delete', requireRole('admin'), (req, res) => {
  run('DELETE FROM scholarships WHERE id = ?', [req.params.id]);
  res.redirect('/scholarships');
});

module.exports = router;
