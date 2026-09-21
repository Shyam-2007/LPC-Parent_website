// Database connection for the LPC Student Parent Hub.
// Uses Node's built-in node:sqlite module (stable in Node 22.5+, no native
// build step required — important since this app should run anywhere
// without a compiler toolchain).
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'lpc_hub.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

// Apply schema (idempotent — every statement uses IF NOT EXISTS).
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

/** Run a SELECT that returns multiple rows. */
function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

/** Run a SELECT that returns a single row (or undefined). */
function get(sql, params = []) {
  return db.prepare(sql).get(...params);
}

/** Run an INSERT/UPDATE/DELETE. Returns { changes, lastInsertRowid }. */
function run(sql, params = []) {
  const info = db.prepare(sql).run(...params);
  return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

module.exports = { db, all, get, run };
