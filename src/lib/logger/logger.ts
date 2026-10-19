/**
 * Pressbench logging.
 *
 * Every module creates a namespaced logger (`createLogger('sync')`) instead of calling `console` directly.
 * By default only `warn` and `error` are emitted. Adding `?debug=1` to the URL turns on `debug` for every
 * namespace and keeps the newest entries in an in-memory buffer; `?debug=playground,sync` turns on `debug`
 * for those namespaces only. See docs/DEBUGGING.md.
 *
 * Never log file contents, tokens or personal data, at any level.
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** A level, or `silent` to emit nothing. */
export type LogThreshold = LogLevel | 'silent';

export type LogData = Readonly<Record<string, unknown>>;

export interface LogEntry {
  readonly time: number;
  readonly level: LogLevel;
  readonly namespace: string;
  readonly message: string;
  readonly data?: LogData;
}

export type LogSink = (entry: LogEntry) => void;

export interface Logger {
  debug(message: string, data?: LogData): void;
  info(message: string, data?: LogData): void;
  warn(message: string, data?: LogData): void;
  error(message: string, data?: LogData): void;
}

export interface LoggingOptions {
  /** Threshold for every namespace not listed in `debugNamespaces`. Defaults to `warn`. */
  readonly level?: LogThreshold;
  /** Namespaces lowered to `debug` (matched case-insensitively), or `all`. */
  readonly debugNamespaces?: readonly string[] | 'all';
  /** Where entries go. Defaults to the browser console. */
  readonly sink?: LogSink;
  /** How many entries to keep in memory. 0 (the default) keeps none. */
  readonly bufferSize?: number;
  /** Clock, injectable for tests. */
  readonly now?: () => number;
}

export interface LoggingSystem {
  createLogger(namespace: string): Logger;
  getThreshold(namespace: string): LogThreshold;
  /** Newest entries, oldest first. Empty unless a buffer size was set. */
  readonly buffer: readonly LogEntry[];
  readonly isBufferEnabled: boolean;
}

/** Entries kept in memory when debug mode is on. */
export const DEBUG_BUFFER_SIZE = 1_000;

const LEVEL_RANK: Readonly<Record<LogThreshold, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/** Writes an entry to the console method that matches its level. */
export const consoleSink: LogSink = (entry) => {
  const text = `[${entry.namespace}] ${entry.message}`;
  const args: unknown[] = entry.data === undefined ? [text] : [text, entry.data];
  // The logger is the one place allowed to use the console.
  /* eslint-disable no-console */
  switch (entry.level) {
    case 'debug':
      console.debug(...args);
      break;
    case 'info':
      console.info(...args);
      break;
    case 'warn':
      console.warn(...args);
      break;
    case 'error':
      console.error(...args);
      break;
  }
  /* eslint-enable no-console */
};

/** Creates an independent logging system. Most code should use the module-level `createLogger` instead. */
export function createLoggingSystem(options: LoggingOptions = {}): LoggingSystem {
  const baseLevel = options.level ?? 'warn';
  const requested = options.debugNamespaces ?? [];
  const debugNamespaces =
    requested === 'all' ? 'all' : new Set(requested.map((name) => name.toLowerCase()));
  const sink = options.sink ?? consoleSink;
  const bufferSize = Math.max(0, options.bufferSize ?? 0);
  const now = options.now ?? Date.now;
  const buffer: LogEntry[] = [];

  function getThreshold(namespace: string): LogThreshold {
    if (debugNamespaces === 'all' || debugNamespaces.has(namespace.toLowerCase())) {
      return 'debug';
    }
    return baseLevel;
  }

  function emit(
    level: LogLevel,
    namespace: string,
    message: string,
    data: LogData | undefined,
  ): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[getThreshold(namespace)]) {
      return;
    }
    const entry: LogEntry =
      data === undefined
        ? { time: now(), level, namespace, message }
        : { time: now(), level, namespace, message, data };

    if (bufferSize > 0) {
      buffer.push(entry);
      if (buffer.length > bufferSize) {
        buffer.splice(0, buffer.length - bufferSize);
      }
    }

    try {
      sink(entry);
    } catch {
      // Logging must never break the code that logs. A broken sink is dropped silently.
    }
  }

  return {
    createLogger(namespace) {
      return {
        debug: (message, data) => {
          emit('debug', namespace, message, data);
        },
        info: (message, data) => {
          emit('info', namespace, message, data);
        },
        warn: (message, data) => {
          emit('warn', namespace, message, data);
        },
        error: (message, data) => {
          emit('error', namespace, message, data);
        },
      };
    },
    getThreshold,
    buffer,
    isBufferEnabled: bufferSize > 0,
  };
}

/**
 * Reads the `debug` query parameter.
 *
 * @returns `'all'` for `?debug`, `?debug=1` or `?debug=true`; a list for `?debug=playground,sync`;
 *   `null` when debug is off.
 */
export function parseDebugParam(search: string): readonly string[] | 'all' | null {
  const value = new URLSearchParams(search).get('debug');
  if (value === null) {
    return null;
  }
  const normalised = value.trim().toLowerCase();
  if (normalised === '0' || normalised === 'false') {
    return null;
  }
  if (normalised === '' || normalised === '1' || normalised === 'true') {
    return 'all';
  }
  const namespaces = normalised
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return namespaces.length > 0 ? namespaces : null;
}

let activeSystem: LoggingSystem = createLoggingSystem();

/** Replaces the module-level logging system. Loggers already created pick up the change. */
export function configureLogging(options: LoggingOptions): LoggingSystem {
  activeSystem = createLoggingSystem(options);
  return activeSystem;
}

/**
 * Configures module-level logging from a URL query string (usually `window.location.search`).
 *
 * @example
 * const system = initLoggingFromUrl(window.location.search);
 */
export function initLoggingFromUrl(
  search: string,
  options: Pick<LoggingOptions, 'sink' | 'now'> = {},
): LoggingSystem {
  const debugNamespaces = parseDebugParam(search);
  return configureLogging({
    ...options,
    level: 'warn',
    debugNamespaces: debugNamespaces ?? [],
    bufferSize: debugNamespaces === null ? 0 : DEBUG_BUFFER_SIZE,
  });
}

/**
 * Returns a logger for one namespace (`playground`, `sync`, `editor`, `fs`, `storage`, `scaffold`, `ui`).
 * Safe to call at module load time: each call is routed to the system configured at that moment.
 */
export function createLogger(namespace: string): Logger {
  return {
    debug: (message, data) => {
      activeSystem.createLogger(namespace).debug(message, data);
    },
    info: (message, data) => {
      activeSystem.createLogger(namespace).info(message, data);
    },
    warn: (message, data) => {
      activeSystem.createLogger(namespace).warn(message, data);
    },
    error: (message, data) => {
      activeSystem.createLogger(namespace).error(message, data);
    },
  };
}
