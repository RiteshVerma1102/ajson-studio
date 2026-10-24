/**
 * Safe LocalStorage access wrapper with in-memory fallbacks and try/catch guards.
 */

const memoryFallback = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // SecurityError or QuotaExceededError in restricted iframe/browser mode
    }
    return memoryFallback.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fall through to memory fallback
    }
    memoryFallback.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fall through to memory fallback
    }
    memoryFallback.delete(key);
  },
};
