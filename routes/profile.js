const express = require('express');
const { get, run } = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PARENTING_STAGES = [
  ['expecting', 'Expecting'],
  ['infant', 'Infant (0-1)'],
  ['toddler', 'Toddler (1-3)'],
  ['preschool', 'Preschool (3-5)'],
  ['school_age', 'School age (5-12)'],
  ['teen', 'Teen (13+)'],
  ['multiple_stages', 'Multiple stages / been through several'],
];

const AVAILABILITY_TAGS = [
  ['weekday_am', 'Weekday mornings'],
  ['weekday_pm', 'Weekday evenings'],
  ['weekend', 'Weekends'],
  ['during_class_breaks', 'During class breaks'],
];

const INTEREST_TAGS = [
  ['single_parent', 'Single parent'],
  ['first_gen', 'First-generation student'],
  ['transfer', 'Transfer-track'],
  ['stem', 'STEM major'],
  ['working_student', 'Working while in school'],
  ['calworks', 'CalWORKs/CARE participant'],
  ['returning_student', 'Returning after a gap'],
  ['financial_aid_help', 'Navigating financial aid'],
];

router.get('/profile/edit', requireAuth, (req, res) => {
  const profile = get('SELECT * FROM profiles WHERE user_id = ?', [req.session.user.id]) || {};
  res.render('profile_edit', {
    title: 'My Profile',
    profile,
    PARENTING_STAGES,
    AVAILABILITY_TAGS,
    INTEREST_TAGS,
    welcome: req.query.welcome === '1',
    saved: false,
  });
});

router.post('/profile/edit', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const {
    major, parenting_stage, child_age_min, child_age_max, bio, phone,
    wants_mentor, is_mentor_candidate, accepting_mentees, max_mentees,
  } = req.body;

  const availability = [].concat(req.body.availability || []).join(',');
  const interests = [].concat(req.body.interests || []).join(',');
  const toIntOrNull = (v) => (v === undefined || v === null || v === '') ? null : Number(v);

  const existing = get('SELECT user_id FROM profiles WHERE user_id = ?', [userId]);
  const values = [
    major || null,
    parenting_stage || null,
    toIntOrNull(child_age_min),
    toIntOrNull(child_age_max),
    availability,
    interests,
    bio || '',
    phone || '',
    wants_mentor ? 1 : 0,
    is_mentor_candidate ? 1 : 0,
    accepting_mentees ? 1 : 0,
    toIntOrNull(max_mentees) ?? 3,
  ];

  if (existing) {
    run(
      `UPDATE profiles SET major=?, parenting_stage=?, child_age_min=?, child_age_max=?, availability=?, interests=?, bio=?, phone=?, wants_mentor=?, is_mentor_candidate=?, accepting_mentees=?, max_mentees=?, updated_at=datetime('now')
       WHERE user_id=?`,
      [...values, userId]
    );
  } else {
    run(
      `INSERT INTO profiles (user_id, major, parenting_stage, child_age_min, child_age_max, availability, interests, bio, phone, wants_mentor, is_mentor_candidate, accepting_mentees, max_mentees)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, ...values]
    );
  }

  const profile = get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  res.render('profile_edit', {
    title: 'My Profile',
    profile,
    PARENTING_STAGES,
    AVAILABILITY_TAGS,
    INTEREST_TAGS,
    welcome: false,
    saved: true,
  });
});

module.exports = { router, PARENTING_STAGES, AVAILABILITY_TAGS, INTEREST_TAGS };
