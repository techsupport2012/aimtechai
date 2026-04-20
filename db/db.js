const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'aimtechai.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read and execute schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Add content_markdown column if it doesn't exist (safe migration)
try { db.exec('ALTER TABLE blog_posts ADD COLUMN content_markdown TEXT'); } catch {}

// Query helpers
function get(sql, params = []) {
  return db.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
}

function all(sql, params = []) {
  return db.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
}

function run(sql, params = []) {
  return db.prepare(sql).run(...(Array.isArray(params) ? params : [params]));
}

function insert(table, obj) {
  const keys = Object.keys(obj);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  return db.prepare(sql).run(...Object.values(obj));
}

function update(table, id, obj) {
  const keys = Object.keys(obj);
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const sql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
  return db.prepare(sql).run(...Object.values(obj), id);
}

module.exports = { db, get, all, run, insert, update };
