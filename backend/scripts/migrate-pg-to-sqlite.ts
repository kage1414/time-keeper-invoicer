/**
 * Migrates data from PostgreSQL to SQLite.
 *
 * Usage:
 *   DATABASE_PATH=/path/to/db.sqlite PG_URL=postgresql://postgres:postgres@localhost:5433/invoicer npx tsx scripts/migrate-pg-to-sqlite.ts
 */

import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const PG_URL = process.env.PG_URL || 'postgresql://postgres:postgres@localhost:5433/invoicer';
const SQLITE_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'db.sqlite');

function toSQLiteVal(val: any): any {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'boolean') return val ? 1 : 0;
  return val;
}

function rowToSQLite(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = toSQLiteVal(v);
  }
  return out;
}

async function main() {
  console.log(`Source: ${PG_URL}`);
  console.log(`Target: ${SQLITE_PATH}`);

  // Connect to postgres
  const client = new pg.Client({ connectionString: PG_URL });
  await client.connect();
  console.log('Connected to PostgreSQL');

  // Open SQLite
  if (!fs.existsSync(path.dirname(SQLITE_PATH))) {
    fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  }
  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma('foreign_keys = OFF');
  console.log('Opened SQLite database');

  // Check SQLite has tables (migrations must have run)
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'knex_%' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  if (tables.length === 0) {
    console.error('SQLite has no tables — run migrations first (yarn migrate or start the server once)');
    process.exit(1);
  }
  console.log('SQLite tables found:', tables.map(t => t.name).join(', '));

  // Wipe existing data in reverse dependency order
  console.log('\nClearing existing SQLite data...');
  const wipeOrder = ['user_settings', 'credits', 'invoice_line_items', 'time_entries', 'invoices', 'projects', 'clients', 'invites', 'users'];
  for (const table of wipeOrder) {
    sqlite.prepare(`DELETE FROM ${table}`).run();
    // Reset autoincrement sequence
    sqlite.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
    console.log(`  Cleared ${table}`);
  }

  // Migration order (respects FK dependencies)
  const migrationOrder = ['users', 'invites', 'clients', 'projects', 'invoices', 'time_entries', 'invoice_line_items', 'credits', 'user_settings'];

  for (const table of migrationOrder) {
    const { rows } = await client.query(`SELECT * FROM ${table} ORDER BY id`);
    if (rows.length === 0) {
      console.log(`\n${table}: 0 rows, skipping`);
      continue;
    }

    // Get columns that actually exist in SQLite for this table
    const sqliteColumns = new Set(
      (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name)
    );

    const pgColumns = Object.keys(rows[0]);
    const columns = pgColumns.filter(c => sqliteColumns.has(c));
    const skipped = pgColumns.filter(c => !sqliteColumns.has(c));
    if (skipped.length > 0) {
      console.log(`  (skipping PG-only columns: ${skipped.join(', ')})`);
    }

    const placeholders = columns.map(() => '?').join(', ');
    const stmt = sqlite.prepare(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
    );

    const insertMany = sqlite.transaction((records: any[]) => {
      for (const row of records) {
        const converted = rowToSQLite(row);
        stmt.run(columns.map(c => converted[c]));
      }
    });

    insertMany(rows);
    console.log(`\n${table}: inserted ${rows.length} rows`);

    // Update the SQLite autoincrement counter to the max id
    const maxId = Math.max(...rows.map((r: any) => r.id));
    try {
      sqlite.prepare(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)`).run(table, maxId);
    } catch {
      // sqlite_sequence only exists if at least one AUTOINCREMENT has been used
    }
  }

  // Re-enable foreign keys and verify
  sqlite.pragma('foreign_keys = ON');

  console.log('\n--- Verification ---');
  for (const table of migrationOrder) {
    const { rows } = await client.query(`SELECT COUNT(*) FROM ${table}`);
    const pgCount = parseInt(rows[0].count);
    const sqliteCount = (sqlite.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number }).cnt;
    const ok = pgCount === sqliteCount ? '✓' : '✗ MISMATCH';
    console.log(`  ${table}: PG=${pgCount}, SQLite=${sqliteCount} ${ok}`);
  }

  await client.end();
  sqlite.close();
  console.log('\nMigration complete!');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
