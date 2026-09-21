// Change the admin account's email and/or password directly in the
// database. There's no in-app "change password" screen yet, so this is the
// supported way to do it — locally, or on a live deploy via your host's
// Shell tab (e.g. Render: Service > Shell).
//
// Usage:
//   node db/manage-admin.js <newEmail> <newPassword> [currentEmailToTarget]
//
// Examples:
//   node db/manage-admin.js hub-admin@laspositascollege.edu "S0meLongerPassword!"
//   node db/manage-admin.js hub-admin@laspositascollege.edu "S0meLongerPassword!" admin@laspositascollege.edu
//
// If you only have one admin account (the normal case), you can omit the
// third argument — the script finds it automatically. If there's more than
// one, it'll list them and ask you to specify which one to update.

const bcrypt = require('bcryptjs');
const { all, get, run } = require('./db');

function main() {
  const [, , newEmail, newPassword, targetCurrentEmail] = process.argv;

  if (!newEmail || !newPassword) {
    console.error('Usage: node db/manage-admin.js <newEmail> <newPassword> [currentEmailToTarget]');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    console.error('That doesn\'t look like a valid email address.');
    process.exit(1);
  }

  let admin;
  if (targetCurrentEmail) {
    admin = get('SELECT * FROM users WHERE email = ? AND role = ?', [targetCurrentEmail.toLowerCase().trim(), 'admin']);
    if (!admin) {
      console.error(`No admin account found with email "${targetCurrentEmail}".`);
      process.exit(1);
    }
  } else {
    const admins = all('SELECT * FROM users WHERE role = ? ORDER BY id ASC', ['admin']);
    if (admins.length === 0) {
      console.error('No admin account exists yet — run `npm run seed:prod` (or `npm run seed`) first.');
      process.exit(1);
    }
    if (admins.length > 1) {
      console.error('More than one admin account exists. Re-run with the current email of the one to update:');
      admins.forEach((a) => console.error(`  - ${a.email}`));
      process.exit(1);
    }
    admin = admins[0];
  }

  const clash = get('SELECT id FROM users WHERE email = ? AND id != ?', [newEmail.toLowerCase().trim(), admin.id]);
  if (clash) {
    console.error(`Another account already uses "${newEmail}". Choose a different email.`);
    process.exit(1);
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  run('UPDATE users SET email = ?, password_hash = ? WHERE id = ?', [newEmail.toLowerCase().trim(), hash, admin.id]);

  console.log(`Updated admin account (was "${admin.email}").`);
  console.log(`New login: ${newEmail.toLowerCase().trim()} / (the password you just set)`);
}

main();
