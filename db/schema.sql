-- Las Positas College Student Parent Hub — database schema (SQLite)

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student_parent', 'mentor', 'admin')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  major TEXT,
  parenting_stage TEXT CHECK (parenting_stage IN ('expecting','infant','toddler','preschool','school_age','teen','multiple_stages')),
  child_age_min INTEGER,
  child_age_max INTEGER,
  availability TEXT,            -- comma-separated tags e.g. "weekday_am,weekday_pm,weekend"
  interests TEXT,                -- comma-separated tags e.g. "stem,transfer,first_gen,single_parent"
  bio TEXT,
  phone TEXT,
  wants_mentor INTEGER DEFAULT 0,       -- 1 if this student parent wants a mentor
  is_mentor_candidate INTEGER DEFAULT 0, -- 1 if this user has opted in to be a mentor
  accepting_mentees INTEGER DEFAULT 1,
  max_mentees INTEGER DEFAULT 3,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  provider TEXT,
  description TEXT,
  amount TEXT,
  deadline TEXT,
  eligibility_tags TEXT,        -- comma-separated e.g. "student_parent,calworks,transfer"
  link TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daycare_centers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  age_range TEXT,
  notes TEXT,
  outreach_status TEXT NOT NULL DEFAULT 'not_contacted'
    CHECK (outreach_status IN ('not_contacted','contacted','in_talks','partnered','declined')),
  contact_person TEXT,
  last_contacted TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  breakdown TEXT,                -- JSON string of per-criterion scores
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested','accepted','declined','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  UNIQUE(mentor_id, mentee_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('direct','group')),
  name TEXT,
  match_id INTEGER REFERENCES matches(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_matches_mentor ON matches(mentor_id);
CREATE INDEX IF NOT EXISTS idx_matches_mentee ON matches(mentee_id);
