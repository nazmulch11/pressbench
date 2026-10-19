import { createLogger } from '@/lib/logger';

const log = createLogger('storage');
const PREFIX = 'pressbench.';

/**
 * Small per-browser settings (panel sizes, visibility). Values are JSON; a missing or unreadable value gives the
 * caller's default. A storage that throws (private mode, quota, disabled cookies) degrades to memory for the session.
 */
export interface Preferences {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

/**
 * Creates {@link Preferences} over a Web Storage area, usually `window.localStorage`. Pass `null` where no storage is
 * available (tests, server rendering) to keep everything in memory.
 */
export function createPreferences(storage: Storage | null): Preferences {
  const memory = new Map<string, string>();

  function readRaw(key: string): string | null {
    if (storage !== null) {
      try {
        // The storage wins over memory, so a value changed in another tab is seen here.
        return storage.getItem(key) ?? memory.get(key) ?? null;
      } catch (error: unknown) {
        log.warn('preference read failed; using memory', { key, error: String(error) });
      }
    }
    return memory.get(key) ?? null;
  }

  function writeRaw(key: string, value: string | null): void {
    if (value === null) {
      memory.delete(key);
    } else {
      memory.set(key, value);
    }
    if (storage === null) {
      return;
    }
    try {
      if (value === null) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, value);
      }
    } catch (error: unknown) {
      log.warn('preference write failed; kept in memory', { key, error: String(error) });
    }
  }

  return {
    get(key, fallback) {
      const raw = readRaw(PREFIX + key);
      if (raw === null) {
        return fallback;
      }
      try {
        return JSON.parse(raw) as typeof fallback;
      } catch {
        log.warn('preference holds invalid JSON; using the default', { key });
        return fallback;
      }
    },
    set(key, value) {
      writeRaw(PREFIX + key, JSON.stringify(value));
    },
    remove(key) {
      writeRaw(PREFIX + key, null);
    },
  };
}

/** `window.localStorage`, or `null` where reading it throws (for example with cookies disabled). */
export function browserLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (error: unknown) {
    log.warn('localStorage is unavailable; preferences live in memory', { error: String(error) });
    return null;
  }
}
