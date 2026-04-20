/**
 * One-shot data migrator: SQLite (data/aimtechai.db) → MySQL (Hostinger).
 *
 * Run after creating the MySQL schema (db/schema-mysql.sql):
 *   node db/migrate-sqlite-to-mysql.js
 *
 * Reads MySQL credentials from .env. SQLite path is fixed to data/aimtechai.db.
 */

require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');

const SQLITE_PATH = path.join(__dirname, '..', 'data', 'aimtechai.db');

// Order matters — parents before children for foreign-key compliance.
const TABLES = [
  'users',
  'sessions',
  'pages',
  'blog_posts',
  'contacts',
  'pipeline_stages',
  'deals',
  'bookings',
  'agents',
  'agent_runs',
  'visitors',
  'page_views',
  'notifications',
  'settings',
  'kb_entries',
  'chat_queries',
];

(async function main() {
  console.log('[migrate] source:', SQLITE_PATH);
  console.log('[migrate] target:', process.env.MYSQL_HOST + ':' + (process.env.MYSQL_PORT || 3306) + '/' + process.env.MYSQL_DATABASE);

  if (!process.env.MYSQL_HOST) {
    console.error('FATAL: MYSQL_HOST is not set in .env. Add it and rerun.');
    process.exit(1);
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 4,
    multipleStatements: false,
    dateStrings: true,
  });

  // Quick connection sanity check
  try {
    const [r] = await pool.query('SELECT 1 AS ok');
    if (!r[0] || r[0].ok !== 1) throw new Error('unexpected response');
  } catch (e) {
    console.error('FATAL: cannot connect to MySQL:', e.message);
    console.error('Did you enable Remote MySQL in Hostinger and whitelist your IP?');
    process.exit(2);
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');

  let totalRows = 0;
  for (const table of TABLES) {
    let rows;
    try {
      rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    } catch (e) {
      console.warn('[skip]', table, '— not in SQLite:', e.message);
      continue;
    }
    if (!rows.length) {
      console.log('[empty]', table);
      continue;
    }

    const cols = Object.keys(rows[0]);
    const colSql = cols.map((c) => '`' + c + '`').join(', ');
    const placeholders = '(' + cols.map(() => '?').join(', ') + ')';

    // Wipe target table first so reruns are idempotent
    try { await pool.query('DELETE FROM `' + table + '`'); } catch {}

    let inserted = 0;
    // Insert in chunks of 200 to keep packet size reasonable
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const values = [];
      const placeholderRows = chunk.map((row) => {
        for (const c of cols) {
          let v = row[c];
          // SQLite booleans (INTEGER 0/1) are fine for MySQL TINYINT(1).
          // Dates are TEXT in SQLite, MySQL is fine accepting them.
          if (v === undefined) v = null;
          values.push(v);
        }
        return placeholders;
      }).join(', ');

      const sql = `INSERT INTO \`${table}\` (${colSql}) VALUES ${placeholderRows}`;
      try {
        const [res] = await pool.query(sql, values);
        inserted += res.affectedRows;
      } catch (e) {
        console.error('[error]', table, i, '→', e.message);
      }
    }

    console.log('[ok]', table, '—', inserted, '/', rows.length, 'rows');
    totalRows += inserted;

    // Re-sync auto-increment to the highest existing id
    if (cols.includes('id')) {
      try {
        const [m] = await pool.query('SELECT COALESCE(MAX(id), 0) + 1 AS nx FROM `' + table + '`');
        await pool.query('ALTER TABLE `' + table + '` AUTO_INCREMENT = ' + m[0].nx);
      } catch {}
    }
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await pool.end();
  sqlite.close();

  console.log('');
  console.log('[migrate] done — total rows migrated:', totalRows);
  console.log('Now flip DB_DRIVER=mysql in .env and restart the server.');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(99);
});
