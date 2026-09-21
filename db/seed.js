// Local development seed: creates the admin account, starter scholarships
// and daycare data (via seed-core.js), PLUS fake demo accounts with known
// passwords so you have someone to log in as while testing locally.
//
// Do NOT run this against your live production database — use
// `npm run seed:prod` there instead, which skips the demo accounts.
//
// Run with: npm run seed

const { get, run } = require('./db');
const { seedCore, upsertUser, upsertProfile } = require('./seed-core');

function main() {
  console.log('Seeding LPC Student Parent Hub (development data)...');

  const { adminId, communityId } = seedCore();

  // --- Example mentor accounts ---
  const mentor1 = upsertUser({
    email: 'mentor.rosa@example.com',
    password: 'Password123!',
    first_name: 'Rosa',
    last_name: 'Delgado',
    role: 'mentor',
  });
  upsertProfile(mentor1, {
    major: 'Nursing',
    parenting_stage: 'school_age',
    child_age_min: 6, child_age_max: 9,
    availability: 'weekday_pm,weekend',
    interests: 'single_parent,transfer,first_gen,stem',
    bio: 'LPC alum, now in a BSN program. Raised two kids while going through community college full-time — happy to talk scheduling, CalWORKs paperwork, and study strategies.',
    phone: '',
    is_mentor_candidate: true,
    accepting_mentees: true,
    max_mentees: 3,
  });

  const mentor2 = upsertUser({
    email: 'mentor.james@example.com',
    password: 'Password123!',
    first_name: 'James',
    last_name: 'Ortiz',
    role: 'mentor',
  });
  upsertProfile(mentor2, {
    major: 'Business Administration',
    parenting_stage: 'multiple_stages',
    child_age_min: 3, child_age_max: 14,
    availability: 'weekday_am,weekend',
    interests: 'single_parent,working_student,transfer',
    bio: 'Full-time working dad, part-time student. Went through LPC CalWORKs and CARE programs. Can help with time management and financial aid questions.',
    phone: '',
    is_mentor_candidate: true,
    accepting_mentees: true,
    max_mentees: 2,
  });

  // --- Example student-parent (mentee) account ---
  const mentee1 = upsertUser({
    email: 'student.maria@example.com',
    password: 'Password123!',
    first_name: 'Maria',
    last_name: 'Sanchez',
    role: 'student_parent',
  });
  upsertProfile(mentee1, {
    major: 'Nursing',
    parenting_stage: 'toddler',
    child_age_min: 2, child_age_max: 2,
    availability: 'weekday_pm,weekend',
    interests: 'single_parent,first_gen,stem',
    bio: 'First semester nursing prerequisite student, parenting a 2-year-old. Looking for a mentor and childcare options near campus.',
    phone: '',
    wants_mentor: true,
  });

  // Add the demo accounts to the community chat room too.
  for (const uid of [mentor1, mentor2, mentee1]) {
    const already = get(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
      [communityId, uid]
    );
    if (!already) {
      run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [communityId, uid]);
    }
  }

  console.log('Seed complete.');
  console.log('Admin login: admin@laspositascollege.edu / ChangeMe123!  (change this immediately)');
  console.log('Example mentor login: mentor.rosa@example.com / Password123!');
  console.log('Example student-parent login: student.maria@example.com / Password123!');
}

main();
