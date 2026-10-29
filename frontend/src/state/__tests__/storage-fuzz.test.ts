import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeStorage } from '../storage';
import { useLayoutStore } from '../layoutStore';
import { useEditorStore } from '../editorStore';

describe('Storage Robustness & Fuzz Testing', () => {
  beforeEach(() => {
    localStorage.clear();
    safeStorage.clear();
  });

  const garbageInputs = [
    '{malformed json: true, missing quote',
    'undefined',
    'null',
    'NaN',
    '<html><body><script>alert("xss")</script></body></html>',
    '{"activeView": 999999, "sidebarSize": "NaN", "theme": null}',
    '{"tabs": "not-an-array", "activeTabId": {"evil": "object"}}',
    '[Circular Reference ...]',
    '\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0E\x0F',
    '🚀💥🔥'.repeat(1000),
  ];

  const knownKeys = [
    'ajson_layout_state_v1',
    'ajson_theme',
    'ajson_editor_tabs_v1',
    'ajson_chat_history',
    'ajson_terminal_sessions',
    'ajson_recent_projects',
  ];

  it('boots and recovers cleanly when all known keys contain corrupted garbage', () => {
    for (const key of knownKeys) {
      const randomGarbage = garbageInputs[Math.floor(Math.random() * garbageInputs.length)]!;
      localStorage.setItem(key, randomGarbage);
    }

    // Verify stores initialize without throwing
    expect(() => {
      const layout = useLayoutStore.getState();
      expect(layout.activeView).toBe('editor');
      expect(layout.sidebarSize).toBeGreaterThan(0);
      expect(['dark', 'light', 'high-contrast']).toContain(layout.theme);
    }).not.toThrow();

    expect(() => {
      const editor = useEditorStore.getState();
      expect(Array.isArray(editor.tabs)).toBe(true);
      expect(editor.tabs.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it('handles QuotaExceededError smoothly via in-memory fallback', () => {
    const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw quotaError;
    });

    const success = safeStorage.setItem('test_key', 'test_value');
    expect(success).toBe(false);

    // Verify it fell back to memory and can be retrieved
    const retrieved = safeStorage.getItem('test_key');
    expect(retrieved).toBe('test_value');

    setItemSpy.mockRestore();
  });

  it('handles security error when localStorage access is disallowed in restricted iframe', () => {
    const secError = new DOMException('SecurityError', 'SecurityError');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw secError;
    });

    expect(() => {
      const val = safeStorage.getItem('any_key');
      expect(val).toBeNull();
    }).not.toThrow();

    getItemSpy.mockRestore();
  });
});
