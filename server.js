require('dotenv').config();
const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');

const { store, secret } = require('./lib/sessionStore');
const { setupSocket } = require('./lib/socket');
const { attachUser } = require('./middleware/auth');

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
