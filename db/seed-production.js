// Production seed: creates ONLY the admin account, community chat room, and
// starter scholarships/daycare data. No fake demo accounts with published
// passwords get created on a real, public database.
//
// Run this once, the first time you deploy, using your host's shell/console
// (e.g. Render's "Shell" tab for the service):
//
//   npm run seed:prod
//
// Change the admin password immediately after your first login.

const { seedCore } = require('./seed-core');

function main() {
  console.log('Seeding LPC Student Parent Hub (production — no demo accounts)...');
  seedCore();
  console.log('Seed complete.');
  console.log('Admin login: admin@laspositascollege.edu / ChangeMe123!');
  console.log('>>> Log in and change this password right away. <<<');
}

main();
