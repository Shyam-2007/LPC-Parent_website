require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');

const { store, secret } = require('./lib/sessionStore');
const { setupSocket } = require('./lib/socket');
const { attachUser } = require('./middleware/auth');
const { seedCore } = require('./db/seed-core');

// Seed the admin account + starter scholarships/daycare data on every boot.
// This is safe to run repeatedly (it checks for existing rows before
// inserting anything), and it matters a lot on hosts without shell access
// (e.g. Render's free tier) or without a persistent disk: without this,
// there would be no way to (re)create the admin account at all after a
// restart wipes an ephemeral database. Set ADMIN_EMAIL / ADMIN_PASSWORD env
// vars to control the initial admin credentials instead of the built-in
// default — especially worth doing once you're on a persistent disk, since
// at that point this only actually runs once.
try {
  seedCore({
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
  console.log('Startup seed check complete (admin account + starter data present).');
} catch (err) {
  console.error('Startup seed failed:', err);
}

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const { router: profileRoutes } = require('./routes/profile');
const scholarshipRoutes = require('./routes/scholarships');
const daycareRoutes = require('./routes/daycare');
const mentorRoutes = require('./routes/mentors');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  name: 'lpc.sid',
  secret,
  store,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    sameSite: 'lax',
  },
}));

app.use(attachUser);

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(profileRoutes);
app.use(scholarshipRoutes);
app.use(daycareRoutes);
app.use(mentorRoutes);
app.use(chatRoutes);

app.use((req, res) => {
  res.status(404).render('error', { title: 'Not found', message: 'That page does not exist.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'An unexpected error occurred. Please try again.' });
});

setupSocket(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`LPC Student Parent Hub running at http://localhost:${PORT}`);
});
