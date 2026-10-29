/**
 * Safe LocalStorage access wrapper with in-memory fallbacks and try/catch guards.
 * Handles corrupted JSON payloads, quota exceeded errors, and restricted sandbox modes.
 */

const memoryFallback = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // SecurityError in restricted iframe or sandbox
    }
    return memoryFallback.get(key) ?? null;
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (err) {
      // Handles DOMException QuotaExceededError (code 22 or 1014)
      console.warn(`[safeStorage] Storage write failed for key "${key}", falling back to memory:`, err);
    }
    memoryFallback.set(key, value);
    return false;
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fall through to memory
    }
    memoryFallback.delete(key);
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {
      // Fall through to memory
    }
    memoryFallback.clear();
  },

  getMemoryFallback(): ReadonlyMap<string, string> {
    return memoryFallback;
  },
};
