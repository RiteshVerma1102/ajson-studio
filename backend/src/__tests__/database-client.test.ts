import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, runMigrations, type Db } from '../database/client';
import { SettingsService } from '../services/settingsService';

describe('Backend Database & Settings Service', () => {
  let tmpDir: string;
  let db: Db;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajson-db-test-'));
    db = openDatabase(tmpDir);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('initializes SQLite with WAL pragmas', () => {
    const journalMode = db.pragma('journal_mode', { simple: true });
    expect(journalMode).toBe('wal');

    const foreignKeys = db.pragma('foreign_keys', { simple: true });
    expect(foreignKeys).toBe(1);
  });

  it('runs migrations and creates core schema tables', () => {
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('schema_migrations');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('workspaces');
    expect(tableNames).toContain('tool_audit_log');

    // Idempotent: running again should not throw and should skip applied migrations
    expect(() => runMigrations(db)).not.toThrow();
  });

  it('stores and retrieves settings via SettingsService', () => {
    runMigrations(db);
    const settings = new SettingsService(db);

    // Default value if not set
    expect(settings.get('editor.fontSize', 14)).toBe(14);

    // Set and get primitive
    settings.set('editor.fontSize', 16);
    expect(settings.get('editor.fontSize', 14)).toBe(16);

    // Set and get complex object
    const themeConfig = { mode: 'dark', accent: '#6366f1', syntax: 'one-dark' };
    settings.set('editor.theme', themeConfig);
    expect(settings.get('editor.theme', {})).toEqual(themeConfig);

    // Custom namespace
    settings.set('keybindings.preset', 'vim', 'editor-keys');
    expect(settings.get('keybindings.preset', 'default', 'editor-keys')).toBe('vim');
    expect(settings.get('keybindings.preset', 'default', 'global')).toBe('default');

    // List keys & getAll
    const globalKeys = settings.keys('global');
    expect(globalKeys).toContain('editor.fontSize');
    expect(globalKeys).toContain('editor.theme');

    const allGlobal = settings.getAll('global');
    expect(allGlobal['editor.fontSize']).toBe(16);
    expect(allGlobal['editor.theme']).toEqual(themeConfig);

    // Delete
    settings.delete('editor.fontSize');
    expect(settings.get('editor.fontSize', 14)).toBe(14);
    expect(settings.keys('global')).not.toContain('editor.fontSize');
  });
});
