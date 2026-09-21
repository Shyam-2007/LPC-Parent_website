# LPC Student Parent Hub

A community platform for student parents at Las Positas College (Livermore, CA): scholarships & campus support programs, a daycare-center outreach directory, weighted mentor-mentee matching, and real-time chat.

Built as a plain Node.js + Express app with server-rendered pages (EJS), SQLite for storage (via Node's built-in `node:sqlite`, so there's no native module to compile), and Socket.IO for chat. No build step, no framework lock-in — easy to read, easy to hand off.

## Features

- **Accounts & roles** — student parent, mentor, admin. Email/password auth with hashed passwords.
- **Scholarships & support programs** — searchable/filterable list seeded with real LPC programs (CalWORKs, CARE, LPC Foundation Scholarships, the on-campus Child Development Center) plus national scholarships relevant to student parents. Admins can add/remove entries.
- **Daycare directory** — a lightweight CRM: track each center's outreach status (not contacted → contacted → in talks → partnered/declined), notes, and contact info.
- **Mentor matching** — a weighted scoring engine (0-100) matches mentees to mentors on field of study, parenting-stage experience, schedule overlap, shared interests/support needs, and mentor capacity. Mentees get their top 3 suggestions and choose one; admins can trigger matching for everyone waiting and see all matches with the full score breakdown. See `lib/matching.js` for the scoring logic and rationale.
- **Chat** — a campus-wide community room everyone joins on signup, plus a private direct-message thread automatically created when a mentor match is accepted.

## Running it locally

Requires **Node.js 22.5 or newer** (for built-in SQLite support — check with `node -v`).

```bash
cd lpc-parent-hub
npm install
npm run seed     # creates the database and loads starter data
npm start         # runs at http://localhost:3000
```

### Test logins (from the seed data)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@laspositascollege.edu` | `ChangeMe123!` |
| Mentor | `mentor.rosa@example.com` | `Password123!` |
| Mentor | `mentor.james@example.com` | `Password123!` |
| Student parent | `student.maria@example.com` | `Password123!` |

**Change the admin password immediately after your first deploy.** There's no in-app password-change screen yet — run `npm run admin:set-credentials -- newemail@example.com "NewPassword123!"` (see `db/manage-admin.js`) instead.

The server also self-seeds the admin account and starter data on every boot (see `server.js` / `db/seed-core.js`) — it's safe and won't overwrite a password you've already changed, but it does mean that on a host with no persistent disk (e.g. Render's free tier), the admin account quietly resets to the default credentials above every time the app restarts, since the whole database resets too. That's unavoidable without a persistent disk; it's one more reason the free tier is only for testing, not real use.

## Project layout

```
server.js            App entry point (Express + Socket.IO setup)
render.yaml           Render "Blueprint" — auto-configures hosting + persistent disk + secret
db/schema.sql         Table definitions
db/db.js               SQLite connection + query helpers (reads DB_PATH env var if set)
db/seed-core.js         Shared seed data: admin, community chat, scholarships, daycare centers
db/seed.js              Local dev seed — core data PLUS fake demo accounts (npm run seed)
db/seed-production.js   Production seed — core data only, no demo accounts (npm run seed:prod)
lib/matching.js         The weighted mentor-matching scoring engine
lib/socket.js           Real-time chat, authenticated via the session cookie
lib/sessionStore.js      Shared session store used by both HTTP and chat
routes/                 One file per feature area (auth, profile, scholarships, daycare, mentors, chat, dashboard)
views/                  EJS templates
public/css/style.css    All styling (red/black/white, no CSS framework)
```

## Before this goes live to real students

A few things worth doing before you point real people at this:

1. **Verify the seeded scholarship and daycare data.** The scholarship deadlines/amounts and most daycare contact details are placeholders or general starting points, not verified current data — an admin should confirm details on each organization's site and update via the admin dashboard before publishing. The one exception is the CalWORKs office phone number and the general program descriptions, which came from laspositascollege.edu directly.
2. **Set a real `SESSION_SECRET`** in a `.env` file (copy `.env.example`) — a long random string, not the default.
3. **Add a password-reset flow.** Right now, a forgotten password means an admin has to reset it manually in the database.
4. **Consider a persistent session store.** The app currently uses an in-memory session store, which is simplest to set up but forgets everyone's login on restart and won't work across multiple server instances. If you deploy to a platform that can run a single always-on Node process (Render, Railway, Fly.io, a VPS), this is fine as-is. If you need to scale beyond one instance, swap in a Redis- or SQL-backed session store.
5. **Back up `db/lpc_hub.sqlite` regularly** once real user data is in it — it's a single file, so backing it up is just copying that file somewhere safe.
6. **Decide who else gets admin access** and create their accounts (there's no self-serve admin signup, by design).

## Deploying to Render

This repo includes a `render.yaml` "Blueprint" that sets up the web service, a persistent disk for the database, and a random session secret in one step.

1. **Push this repo to GitHub** (see below if you haven't already).
2. **Create a Render account** at render.com and connect your GitHub account.
3. From the Render dashboard, choose **New > Blueprint**, and select this repo. Render will read `render.yaml` and propose: a web service on the Starter plan (~$7/mo — required for a persistent disk; Render's free tier can't attach one), a 1 GB persistent disk mounted at `/var/data` (~$0.25/mo, plenty of room for this database), and a randomly generated `SESSION_SECRET`. Click **Apply**.
4. Wait for the first deploy to finish, then open the service's **Shell** tab (in the Render dashboard) and run:
   ```
   npm run seed:prod
   ```
   This creates the admin account and starter scholarships/daycare data, **without** the fake demo mentor/student accounts from local dev — those don't belong on a public site.
5. Log in with `admin@laspositascollege.edu` / `ChangeMe123!` at your new `.onrender.com` URL and **change that password immediately** (directly in the database for now — there's no in-app password change screen yet).
6. Optional: add a custom domain under the service's **Settings > Custom Domains**.

### Pushing to GitHub for the first time

If this project isn't in a GitHub repo yet:
```bash
cd lpc-parent-hub
git init
git add .
git commit -m "Initial commit"
```
Then create an empty repository on github.com (no README/gitignore — this project already has one), and follow the "push an existing repository" instructions GitHub shows you, which will look like:
```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```
Every time you want to update the live site afterward, it's just `git add .`, `git commit -m "..."`, `git push` — Render redeploys automatically on every push to `main`.

### Where the data actually lives

Once deployed, `db/lpc_hub.sqlite` sits on the persistent disk attached to your Render web service — physically, on a server in whichever Render region you pick (Render's default is Oregon, US). That's not Las Positas College's own infrastructure, and not "the cloud" in some vague sense — it's a specific company's data center. Worth keeping in mind given the data involved (parenting status, children's ages, financial-need-adjacent info): if this ever becomes an LPC-endorsed tool rather than a student project, loop in the college's IT or student services office on where it's hosted and who can access it. In the meantime, download a copy of `lpc_hub.sqlite` from Render's shell periodically as a backup — it's one file.

### Other hosts

Railway and Fly.io work similarly (persistent volume + `npm start`); the general approach — persistent disk, `SESSION_SECRET` env var, run `npm run seed:prod` once — carries over even though the exact dashboard steps differ. Avoid hosts with fully ephemeral/read-only filesystems (some serverless platforms) unless you move the database to an external service first.

## Extending the mentor-matching engine

The scoring weights and logic live entirely in `lib/matching.js`, separate from the routes that call it. If Shyam's friend wants to change what matters most (e.g. weight shared interests more heavily, or add a new criterion like preferred meeting location), that file is the only place to edit — the rest of the app just calls `computeMatchScore(mentorProfile, menteeProfile, currentMenteeCount)` and displays whatever breakdown it returns.
