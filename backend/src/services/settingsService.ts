/**
 * Settings service: namespaced key-value store backed by SQLite.
 * All values are stored as JSON strings so any serialisable value is accepted.
 */
import { type Db } from '../database/client';
import { AjsonError, ErrorCode } from '@ajson/contracts';

const KEY_RE = /^[a-zA-Z0-9._-]{1,128}$/;
const NS_RE = /^[a-zA-Z0-9._-]{1,64}$/;

function validateKey(key: string): void {
  if (!KEY_RE.test(key)) {
    throw new AjsonError(
      ErrorCode.INVALID_KEY,
      `Settings key "${key}" is invalid. Use only alphanumeric, dot, dash, underscore (max 128 chars).`
    );
  }
}

function validateNamespace(ns: string): void {
  if (!NS_RE.test(ns)) {
    throw new AjsonError(
      ErrorCode.INVALID_PAYLOAD,
      `Settings namespace "${ns}" is invalid.`
    );
  }
}

export class SettingsService {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** Get a typed setting value; returns `defaultValue` if not set. */
  get<T = unknown>(key: string, defaultValue: T, namespace = 'global'): T {
    validateKey(key);
    validateNamespace(namespace);

    const row = this.db
      .prepare('SELECT value FROM settings WHERE namespace = ? AND key = ?')
      .get(namespace, key) as { value: string } | undefined;

    if (!row) return defaultValue;

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return defaultValue;
    }
  }

  /** Set a typed setting value. */
  set<T = unknown>(key: string, value: T, namespace = 'global'): void {
    validateKey(key);
    validateNamespace(namespace);

    this.db
      .prepare(
        `INSERT INTO settings (namespace, key, value, updated_at)
         VALUES (?, ?, ?, unixepoch())
         ON CONFLICT(namespace, key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`
      )
      .run(namespace, key, JSON.stringify(value));
  }

  /** Delete a setting. No-op if not found. */
  delete(key: string, namespace = 'global'): void {
    validateKey(key);
    validateNamespace(namespace);
    this.db
      .prepare('DELETE FROM settings WHERE namespace = ? AND key = ?')
      .run(namespace, key);
  }

  /** List all keys in a namespace. */
  keys(namespace = 'global'): string[] {
    validateNamespace(namespace);
    const rows = this.db
      .prepare('SELECT key FROM settings WHERE namespace = ? ORDER BY key')
      .all(namespace) as { key: string }[];
    return rows.map((r) => r.key);
  }

  /** Get all key-value pairs in a namespace as a plain object. */
  getAll<T extends Record<string, unknown> = Record<string, unknown>>(
    namespace = 'global'
  ): T {
    validateNamespace(namespace);
    const rows = this.db
      .prepare('SELECT key, value FROM settings WHERE namespace = ? ORDER BY key')
      .all(namespace) as { key: string; value: string }[];

    return rows.reduce((acc, { key, value }) => {
      try {
        acc[key] = JSON.parse(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>) as T;
  }
}
