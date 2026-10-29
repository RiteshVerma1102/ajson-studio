-- Migration 0001: Initial schema
-- Workspaces, settings key-value store, and tool audit log.

CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  root_path   TEXT    NOT NULL UNIQUE,
  opened_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  metadata    TEXT    NOT NULL DEFAULT '{}'   -- JSON blob
);

CREATE INDEX IF NOT EXISTS idx_workspaces_root_path ON workspaces(root_path);

-- ---------------------------------------------------------------------------
-- Settings: a simple namespaced key-value store.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  namespace   TEXT    NOT NULL DEFAULT 'global',
  key         TEXT    NOT NULL,
  value       TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (namespace, key)
);

-- ---------------------------------------------------------------------------
-- Tool audit log: every AI tool call is recorded for accountability.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tool_audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_id  TEXT,
  tool_name   TEXT    NOT NULL,
  risk_level  TEXT    NOT NULL DEFAULT 'low', -- low | medium | high
  input_json  TEXT    NOT NULL DEFAULT '{}',
  output_json TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected | completed | failed
  approved_by TEXT,                               -- 'user' | 'auto'
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tool_audit_mission ON tool_audit_log(mission_id);
CREATE INDEX IF NOT EXISTS idx_tool_audit_status  ON tool_audit_log(status);
