/**
 * AJSON Studio — localStorage persistence utilities (Phase 3)
 *
 * All data is stored under the "ajson_studio_" key prefix.
 * Quota and corruption errors are caught and surfaced — never silently swallowed.
 * No JSON document content is logged.
 */

import { AppSettings, DEFAULT_SETTINGS, JsonDocument } from "../types/jsonTools";

const KEYS = {
  settings: "ajson_studio_settings",
  documents: "ajson_studio_documents",
  activeDocId: "ajson_studio_active_doc",
  recentIds: "ajson_studio_recent_ids",
} as const;

// ─── Settings ────────────────────────────────────────────────────

export function loadSettings(): { data: AppSettings; error?: string } {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return { data: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { data: { ...DEFAULT_SETTINGS, ...parsed } };
  } catch (e) {
    return { data: { ...DEFAULT_SETTINGS }, error: String(e) };
  }
}

export function saveSettings(settings: AppSettings): { error?: string } {
  try {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    return {};
  } catch (e) {
    return { error: String(e) };
  }
}

// ─── Documents ────────────────────────────────────────────────────

const MAX_DOCS = 50;

export function loadDocuments(): { data: JsonDocument[]; error?: string } {
  try {
    const raw = localStorage.getItem(KEYS.documents);
    if (!raw) return { data: [] };
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return { data: [], error: "Corrupt document store — reset." };
    return { data: arr as JsonDocument[] };
  } catch (e) {
    return { data: [], error: String(e) };
  }
}

export function saveDocuments(docs: JsonDocument[]): { error?: string } {
  try {
    const trimmed = docs.slice(0, MAX_DOCS);
    localStorage.setItem(KEYS.documents, JSON.stringify(trimmed));
    return {};
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      return { error: "Storage quota exceeded. Please delete some documents." };
    }
    return { error: String(e) };
  }
}

export function clearDocuments(): void {
  localStorage.removeItem(KEYS.documents);
  localStorage.removeItem(KEYS.activeDocId);
  localStorage.removeItem(KEYS.recentIds);
}

export function loadActiveDocId(): string | null {
  return localStorage.getItem(KEYS.activeDocId);
}

export function saveActiveDocId(id: string): void {
  localStorage.setItem(KEYS.activeDocId, id);
}

// ─── Health check (for corrupted-storage recovery) ────────────────

export interface StorageHealth {
  ok: boolean;
  errors: string[];
  /** Approximate bytes used for ajson keys */
  usedBytes: number;
}

export function checkStorageHealth(): StorageHealth {
  const errors: string[] = [];
  let usedBytes = 0;

  for (const key of Object.values(KEYS)) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    usedBytes += key.length + raw.length;
    if (key === KEYS.documents || key === KEYS.settings) {
      try { JSON.parse(raw); } catch {
        errors.push(`Key "${key}" is corrupted (invalid JSON).`);
      }
    }
  }

  return { ok: errors.length === 0, errors, usedBytes };
}

export function repairStorage(): void {
  for (const key of Object.values(KEYS)) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try { JSON.parse(raw); } catch {
      localStorage.removeItem(key);
    }
  }
}
