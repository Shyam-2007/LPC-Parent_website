const express = require('express');
const { all, get, run } = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const STATUS_LABELS = {
  not_contacted: 'Not Contacted',
  contacted: 'Contacted',
  in_talks: 'In Talks',
  partnered: 'Partnered',
  declined: 'Declined',
};

router.get('/daycare', requireAuth, (req, res) => {
  const statusFilter = (req.query.status || '').trim();
  let rows = all('SELECT * FROM daycare_centers ORDER BY name ASC');
  if (statusFilter) rows = rows.filter((r) => r.outreach_status === statusFilter);
  res.render('daycare', {
    title: 'Daycare Directory',
    centers: rows,
    STATUS_LABELS,
    statusFilter,
    isAdmin: req.session.user.role === 'admin',
  });
});

router.get('/daycare/new', requireRole('admin'), (req, res) => {
  res.render('daycare_form', { title: 'Add Daycare Center', center: {}, STATUS_LABELS, error: null });
});

router.post('/daycare/new', requireRole('admin'), (req, res) => {
  let { name, address, phone, website, age_range, notes, outreach_status, contact_person } = req.body;
  if (!name) {
    return res.status(400).render('daycare_form', { title: 'Add Daycare Center', center: req.body, STATUS_LABELS, error: 'Name is required.' });
  }
  address = address || ''; phone = phone || ''; website = website || ''; age_range = age_range || '';
  notes = notes || ''; contact_person = contact_person || '';
  run(
    `INSERT INTO daycare_centers (name, address, phone, website, age_range, notes, outreach_status, contact_person, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, address, phone, website, age_range, notes, outreach_status || 'not_contacted', contact_person, req.session.user.id]
  );
  res.redirect('/daycare');
});

router.get('/daycare/:id/edit', requireRole('admin'), (req, res) => {
  const center = get('SELECT * FROM daycare_centers WHERE id = ?', [req.params.id]);
  if (!center) return res.status(404).render('error', { title: 'Not found', message: 'Daycare center not found.' });
  res.render('daycare_form', { title: 'Edit Daycare Center', center, STATUS_LABELS, error: null });
});

router.post('/daycare/:id/edit', requireRole('admin'), (req, res) => {
  let { name, address, phone, website, age_range, notes, outreach_status, contact_person } = req.body;
  address = address || ''; phone = phone || ''; website = website || ''; age_range = age_range || '';
  notes = notes || ''; contact_person = contact_person || ''; outreach_status = outreach_status || 'not_contacted';
  const lastContactedUpdate = ['contacted', 'in_talks', 'partnered'].includes(outreach_status)
    ? ", last_contacted = datetime('now')" : '';
  run(
    `UPDATE daycare_centers SET name=?, address=?, phone=?, website=?, age_range=?, notes=?, outreach_status=?, contact_person=? ${lastContactedUpdate} WHERE id=?`,
    [name, address, phone, website, age_range, notes, outreach_status, contact_person, req.params.id]
  );
  res.redirect('/daycare');
});

router.post('/daycare/:id/delete', requireRole('admin'), (req, res) => {
  run('DELETE FROM daycare_centers WHERE id = ?', [req.params.id]);
  res.redirect('/daycare');
});

module.exports = router;
