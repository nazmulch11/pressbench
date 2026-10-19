import { describe, expect, it, vi } from 'vitest';

import { createPreferences } from './preferences';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('preferences', () => {
  it('TC-WS-016 returns the default for a missing key or invalid JSON', () => {
    const storage = memoryStorage({ 'pressbench.broken': '{not json' });
    const preferences = createPreferences(storage);

    expect(preferences.get('missing', 1)).toBe(1);
    expect(preferences.get('broken', 'fallback')).toBe('fallback');
  });

  it('TC-WS-016a round-trips values through the storage with a namespaced key', () => {
    const storage = memoryStorage();
    const preferences = createPreferences(storage);

    preferences.set('layout', { sidebar: 300 });

    expect(storage.getItem('pressbench.layout')).toBe('{"sidebar":300}');
    expect(createPreferences(storage).get('layout', null)).toEqual({ sidebar: 300 });
  });

  it('TC-WS-016b falls back to memory when the storage throws', () => {
    const storage = memoryStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const preferences = createPreferences(storage);

    preferences.set('layout', 42);

    expect(preferences.get('layout', 0)).toBe(42);
    expect(preferences.get('other', 'd')).toBe('d');
  });

  it('TC-WS-016c works without any storage', () => {
    const preferences = createPreferences(null);

    expect(preferences.get('a', 'none')).toBe('none');
    preferences.set('a', [1, 2]);
    expect(preferences.get('a', [])).toEqual([1, 2]);
    preferences.remove('a');
    expect(preferences.get('a', 'none')).toBe('none');
  });

  it('TC-WS-016d remove deletes the stored key', () => {
    const storage = memoryStorage({ 'pressbench.a': '1' });
    const preferences = createPreferences(storage);

    preferences.remove('a');

    expect(storage.getItem('pressbench.a')).toBeNull();
  });
});
