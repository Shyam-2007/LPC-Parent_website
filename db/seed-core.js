// Shared seed logic used by BOTH the local dev seed (db/seed.js, which also
// adds fake demo accounts to play with) and the production seed
// (db/seed-production.js, which does not). Keeping this in one place means
// the real scholarship/daycare starter data can't drift between the two.
//
// IMPORTANT: The scholarship deadlines/amounts and daycare contact details
// below are illustrative starting points, not verified current data. Before
// publishing, an admin should confirm live details on each organization's
// website and update via the admin dashboard.

const bcrypt = require('bcryptjs');
const { run, get } = require('./db');

function upsertUser({ email, password, first_name, last_name, role }) {
  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  const { lastInsertRowid } = run(
    'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
    [email, hash, first_name, last_name, role]
  );
  return lastInsertRowid;
}

function upsertProfile(userId, profile) {
  const existing = get('SELECT user_id FROM profiles WHERE user_id = ?', [userId]);
  if (existing) return;
  run(
    `INSERT INTO profiles
      (user_id, major, parenting_stage, child_age_min, child_age_max, availability, interests, bio, phone, wants_mentor, is_mentor_candidate, accepting_mentees, max_mentees)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      profile.major || null,
      profile.parenting_stage || null,
      profile.child_age_min ?? null,
      profile.child_age_max ?? null,
      profile.availability || '',
      profile.interests || '',
      profile.bio || '',
      profile.phone || '',
      profile.wants_mentor ? 1 : 0,
      profile.is_mentor_candidate ? 1 : 0,
      profile.accepting_mentees === false ? 0 : 1,
      profile.max_mentees ?? 3,
    ]
  );
}

function seedScholarship(s) {
  const existing = get('SELECT id FROM scholarships WHERE title = ?', [s.title]);
  if (existing) return;
  run(
    `INSERT INTO scholarships (title, provider, description, amount, deadline, eligibility_tags, link, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.title, s.provider, s.description, s.amount, s.deadline, s.eligibility_tags, s.link, s.created_by]
  );
}

function seedDaycare(d) {
  const existing = get('SELECT id FROM daycare_centers WHERE name = ?', [d.name]);
  if (existing) return;
  run(
    `INSERT INTO daycare_centers (name, address, phone, website, age_range, notes, outreach_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.address, d.phone || '', d.website || '', d.age_range || '', d.notes || '', d.outreach_status || 'not_contacted', d.created_by]
  );
}

/**
 * Seeds the admin account, campus-wide community chat room, starter
 * scholarships, and starter daycare directory. Safe to run repeatedly —
 * every insert checks for an existing row first.
 *
 * @param {object} opts
 * @param {string} [opts.adminEmail]
 * @param {string} [opts.adminPassword]
 * @returns {{ adminId: number, communityId: number }}
 */
function seedCore({ adminEmail = 'admin@laspositascollege.edu', adminPassword = 'ChangeMe123!' } = {}) {
  const adminId = upsertUser({
    email: adminEmail,
    password: adminPassword,
    first_name: 'Hub',
    last_name: 'Admin',
    role: 'admin',
  });

  // --- Campus-wide community chat room ---
  const community = get("SELECT id FROM conversations WHERE type = 'group' AND name = ?", ['Community Chat']);
  let communityId = community?.id;
  if (!communityId) {
    const res = run("INSERT INTO conversations (type, name) VALUES ('group', 'Community Chat')");
    communityId = res.lastInsertRowid;
  }
  const alreadyIn = get(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
    [communityId, adminId]
  );
  if (!alreadyIn) {
    run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [communityId, adminId]);
  }
  const hasWelcome = get('SELECT 1 FROM messages WHERE conversation_id = ? LIMIT 1', [communityId]);
  if (!hasWelcome) {
    run('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)', [
      communityId, adminId,
      'Welcome to the Las Positas College Student Parent Hub community chat! Introduce yourself, ask questions, and support each other here.',
    ]);
  }

  // --- Scholarships & support programs ---
  // Campus programs (details confirmed via laspositascollege.edu, July 2026):
  seedScholarship({
    title: 'CalWORKs Program (LPC)',
    provider: 'Las Positas College',
    description: 'Support for low-income parents with children under 18: cash aid, childcare services, school supplies, and career/education planning in exchange for participation in approved work/education activities.',
    amount: 'Varies (cash aid + support services)',
    deadline: 'Rolling — apply anytime',
    eligibility_tags: 'student_parent,calworks,low_income',
    link: 'https://www.laspositascollege.edu/calworks/',
    created_by: adminId,
  });
  seedScholarship({
    title: 'CARE Program (Cooperative Agencies Resources for Education)',
    provider: 'Las Positas College',
    description: 'Support for single parents receiving CalWORKs/TANF: grants, textbook assistance, school supplies, and personal/academic counseling.',
    amount: 'Varies',
    deadline: 'Rolling — apply anytime',
    eligibility_tags: 'student_parent,single_parent,calworks',
    link: 'https://www.laspositascollege.edu/calworks/',
    created_by: adminId,
  });
  seedScholarship({
    title: 'LPC Child Development Center — On-Campus Childcare',
    provider: 'Las Positas College',
    description: 'On-site childcare for LPC student parents and Tri-Valley community members. Not a scholarship, but essential support — apply early as spots are limited.',
    amount: 'N/A (subsidized options available)',
    deadline: 'Rolling — apply early, space limited',
    eligibility_tags: 'student_parent,childcare',
    link: 'https://www.laspositascollege.edu/',
    created_by: adminId,
  });
  seedScholarship({
    title: 'LPC Foundation Scholarships',
    provider: 'Las Positas College Foundation',
    description: 'Annual scholarship application covering dozens of donor-funded scholarships in one application, including several prioritizing non-traditional and parenting students. Check current cycle dates on the Financial Aid page.',
    amount: 'Varies by award',
    deadline: 'Varies by year — check laspositascollege.edu/financialaid',
    eligibility_tags: 'general,transfer,first_gen',
    link: 'https://www.laspositascollege.edu/financialaid/',
    created_by: adminId,
  });

  // National/regional scholarships commonly relevant to student parents:
  seedScholarship({
    title: 'Soroptimist Live Your Dream Award',
    provider: 'Soroptimist International',
    description: 'For women who are the primary financial support for their families and are enrolled in (or accepted into) an undergraduate or vocational program. Many recipients are single/student parents.',
    amount: 'Local awards $1,000-$3,000; regional/international awards up to $10,000',
    deadline: 'Varies by local club — typically opens fall, check current cycle',
    eligibility_tags: 'student_parent,single_parent,women',
    link: 'https://www.soroptimist.org/our-work/live-your-dream-award/',
    created_by: adminId,
  });
  seedScholarship({
    title: 'Patsy Takemoto Mink Education Foundation Award',
    provider: 'Patsy Takemoto Mink Education Foundation',
    description: 'For low-income women, including mothers, pursuing education or job training who face financial and social barriers.',
    amount: 'Up to $5,000',
    deadline: 'Varies by year — check foundation website',
    eligibility_tags: 'student_parent,women,low_income',
    link: 'https://patsyminkfoundation.org/',
    created_by: adminId,
  });
  seedScholarship({
    title: "Jeannette Rankin Women's Scholarship",
    provider: "Jeannette Rankin Women's Scholarship Fund",
    description: 'For low-income women aged 35+ pursuing technical/vocational training or an undergraduate degree — many applicants are parents balancing work, school, and family.',
    amount: 'Varies by award',
    deadline: 'Varies by year — check foundation website',
    eligibility_tags: 'women,low_income,adult_learner',
    link: 'https://rankinfoundation.org/',
    created_by: adminId,
  });

  // --- Daycare directory (real Livermore-area providers; verify current
  // contact details before outreach — placeholders left blank rather than
  // guessed) ---
  seedDaycare({
    name: 'LPC Child Development Center',
    address: '3000 Campus Hill Dr, Livermore, CA 94551 (on Las Positas College campus)',
    phone: '925-424-1459',
    website: 'https://www.laspositascollege.edu/',
    age_range: 'Infant - Preschool',
    notes: 'On-campus center — already a de facto partner. Confirm current subsidized-slot availability for CalWORKs/CARE students each semester.',
    outreach_status: 'partnered',
    created_by: adminId,
  });
  seedDaycare({
    name: 'KinderCare Livermore (Lassen Rd)',
    address: '4655 Lassen Rd, Livermore, CA 94551',
    phone: '',
    website: 'https://www.kindercare.com/our-centers/livermore/ca',
    age_range: '6 weeks - 5 years',
    notes: 'National chain center near campus. Verify current tuition and any community-college partner discount before outreach.',
    outreach_status: 'not_contacted',
    created_by: adminId,
  });
  seedDaycare({
    name: 'Primrose School of Livermore',
    address: 'Livermore, CA',
    phone: '',
    website: '',
    age_range: 'Infant - School age',
    notes: 'Verify address/contact before outreach.',
    outreach_status: 'not_contacted',
    created_by: adminId,
  });
  seedDaycare({
    name: "Llesa Children's Center",
    address: 'Livermore, CA',
    phone: '',
    website: '',
    age_range: 'Infant - School age',
    notes: 'Verify address/contact before outreach.',
    outreach_status: 'not_contacted',
    created_by: adminId,
  });
  seedDaycare({
    name: 'Bright Minds Academy',
    address: 'Livermore, CA',
    phone: '',
    website: '',
    age_range: 'Preschool',
    notes: 'Verify address/contact before outreach.',
    outreach_status: 'not_contacted',
    created_by: adminId,
  });
  seedDaycare({
    name: 'Building Kidz of Livermore',
    address: 'Livermore, CA',
    phone: '',
    website: '',
    age_range: 'Infant - Preschool',
    notes: 'Verify address/contact before outreach.',
    outreach_status: 'not_contacted',
    created_by: adminId,
  });

  return { adminId, communityId };
}

module.exports = { seedCore, upsertUser, upsertProfile };
