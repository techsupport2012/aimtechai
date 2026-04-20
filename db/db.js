/**
 * Unified DB layer — supports both SQLite (legacy/dev) and MySQL (production).
 * Switch via DB_DRIVER env var: 'sqlite' (default) | 'mysql'.
 *
 * EVERY exported function is async — call sites must use `await`.
 *
 *   const { get, all, run, insert, update } = require('./db/db');
 *   const user = await get('SELECT * FROM users WHERE id = ?', [1]);
 */

const path = require('path');
const fs = require('fs');

const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

let impl;

if (driver === 'mysql') {
  // ---------- MySQL backend ----------
  const mysql = require('mysql2/promise');

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: false,
    timezone: 'Z',
    charset: 'utf8mb4',
    namedPlaceholders: false,
    dateStrings: true, // keep DATETIME as 'YYYY-MM-DD HH:MM:SS' strings (matches SQLite TEXT)
  });

  // Translate SQLite-style placeholders / quirks → MySQL on a best-effort basis.
  // SQLite: `datetime('now')` → MySQL: `NOW()`. Both use `?` placeholders.
  function translate(sql) {
    return String(sql).replace(/datetime\s*\(\s*'now'\s*\)/gi, 'NOW()');
  }

  async function get(sql, params = []) {
    const [rows] = await pool.execute(translate(sql), Array.isArray(params) ? params : [params]);
    return rows[0] || null;
  }

  async function all(sql, params = []) {
    const [rows] = await pool.execute(translate(sql), Array.isArray(params) ? params : [params]);
    return rows;
  }

  async function run(sql, params = []) {
    const [res] = await pool.execute(translate(sql), Array.isArray(params) ? params : [params]);
    return { lastInsertRowid: res.insertId, changes: res.affectedRows };
  }

  async function insert(table, obj) {
    const keys = Object.keys(obj);
    const placeholders = keys.map(() => '?').join(', ');
    const cols = keys.map((k) => '`' + k + '`').join(', ');
    const sql = `INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`;
    return run(sql, Object.values(obj));
  }

  async function update(table, id, obj) {
    const keys = Object.keys(obj);
    const sets = keys.map((k) => '`' + k + '` = ?').join(', ');
    const sql = `UPDATE \`${table}\` SET ${sets} WHERE id = ?`;
    return run(sql, [...Object.values(obj), id]);
  }

  async function exec(sql) {
    const stmts = String(sql).split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
    for (const s of stmts) {
      try { await pool.query(s); } catch (e) {
        if (!/already exists|duplicate column/i.test(e.message)) throw e;
      }
    }
  }

  async function close() { await pool.end(); }

  impl = { driver: 'mysql', get, all, run, insert, update, exec, close, raw: pool };
  console.log('[db] driver = mysql @', process.env.MYSQL_HOST + ':' + (process.env.MYSQL_PORT || 3306));

} else {
  // ---------- SQLite backend (legacy / default) ----------
  const Database = require('better-sqlite3');

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'aimtechai.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  try { db.exec('ALTER TABLE blog_posts ADD COLUMN content_markdown TEXT'); } catch {}

  // Sync helpers wrapped to return Promises so call sites use `await`
  // identically across drivers.
  async function get(sql, params = []) {
    return db.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
  }
  async function all(sql, params = []) {
    return db.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
  }
  async function run(sql, params = []) {
    return db.prepare(sql).run(...(Array.isArray(params) ? params : [params]));
  }
  async function insert(table, obj) {
    const keys = Object.keys(obj);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
    return db.prepare(sql).run(...Object.values(obj));
  }
  async function update(table, id, obj) {
    const keys = Object.keys(obj);
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    const sql = `UPDATE ${table} SET ${sets} WHERE id = ?`;
    return db.prepare(sql).run(...Object.values(obj), id);
  }
  async function exec(sql) { db.exec(sql); }
  async function close() { db.close(); }

  impl = { driver: 'sqlite', db, get, all, run, insert, update, exec, close, raw: db };
  console.log('[db] driver = sqlite @', dbPath);
}

module.exports = impl;
