import { describe, it, expect, beforeEach } from 'vitest';
import { safeStorage } from '../storage';

describe('safeStorage', () => {
  beforeEach(() => {
    safeStorage.removeItem('test_key');
  });

  it('stores and retrieves string items', () => {
    safeStorage.setItem('test_key', 'test_value');
    expect(safeStorage.getItem('test_key')).toBe('test_value');
  });

  it('removes stored items', () => {
    safeStorage.setItem('test_key', 'to_remove');
    safeStorage.removeItem('test_key');
    expect(safeStorage.getItem('test_key')).toBeNull();
  });

  it('returns null for nonexistent keys', () => {
    expect(safeStorage.getItem('nonexistent_key_12345')).toBeNull();
  });
});
