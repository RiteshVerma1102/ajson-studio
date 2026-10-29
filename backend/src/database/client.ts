/**
 * SQLite client: thin wrapper around better-sqlite3 with WAL mode,
 * strict foreign keys, and a migration runner.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Logger } from 'pino';

export type Db = Database.Database;

// ---------------------------------------------------------------------------
// Open + configure
// ---------------------------------------------------------------------------

export function openDatabase(dataDir: string, logger?: Logger): Db {
  const dbPath = path.join(dataDir, 'ajson.db');
  logger?.info({ dbPath }, 'Opening SQLite database');

  const db = new Database(dbPath, { verbose: logger ? (msg) => logger.trace(msg) : undefined });

  // Performance + safety pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 67108864'); // 64 MB

  return db;
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

/** Resolve the migrations directory safely across Node.js, Vite, and JSDOM environments. */
function getMigrationsDir(): string {
  try {
    const url = new URL('../../database/migrations', import.meta.url);
    if (url.protocol === 'file:') {
      return fileURLToPath(url);
    }
  } catch {
    /* fallback below */
  }

  const cwd = typeof process !== 'undefined' ? process.cwd() : '.';
  const candidates = [
    path.resolve(cwd, 'backend/database/migrations'),
    path.resolve(cwd, 'database/migrations'),
    path.resolve(cwd, '../backend/database/migrations'),
    path.resolve(cwd, '../../backend/database/migrations'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return candidates[0]!;
}

/** Create the schema_migrations table if missing. */
function ensureMigrationsTable(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version   INTEGER PRIMARY KEY,
      name      TEXT    NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

/** Return list of already-applied migration versions. */
function appliedVersions(db: Db): Set<number> {
  const rows = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as { version: number }[];
  return new Set(rows.map((r) => r.version));
}

/**
 * Run all pending migrations from `database/migrations/` in version order.
 * Each migration file must be named: `NNNN_description.sql` (4-digit prefix).
 */
export function runMigrations(db: Db, logger?: Logger): void {
  ensureMigrationsTable(db);
  const applied = appliedVersions(db);
  const migrationsDir = getMigrationsDir();

  if (!fs.existsSync(migrationsDir)) {
    logger?.warn({ migrationsDir }, 'Migrations directory not found, skipping');
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = parseInt(file.slice(0, 4), 10);
    if (applied.has(version)) {
      logger?.debug({ file }, 'Migration already applied, skipping');
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const name = file.replace(/^\d{4}_/, '').replace(/\.sql$/, '');

    logger?.info({ file, version }, 'Applying migration');

    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
      ).run(version, name);
    })();

    logger?.info({ file, version }, 'Migration applied');
  }
}
