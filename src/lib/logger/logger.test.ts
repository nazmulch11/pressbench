import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  configureLogging,
  consoleSink,
  createLogger,
  createLoggingSystem,
  initLoggingFromUrl,
  parseDebugParam,
  type LogEntry,
} from './logger';

function collectingSink(): { entries: LogEntry[]; sink: (entry: LogEntry) => void } {
  const entries: LogEntry[] = [];
  return { entries, sink: (entry) => entries.push(entry) };
}

describe('logging system', () => {
  afterEach(() => {
    // Some tests replace the module-level system; restore the default so tests stay independent.
    configureLogging({});
  });

  it('TC-FND-007a matches debug namespaces regardless of case', () => {
    const { entries, sink } = collectingSink();
    const system = initLoggingFromUrl('?debug=debugPanel', { sink });

    system.createLogger('debugPanel').debug('shown');
    system.createLogger('DEBUGPANEL').debug('also shown');
    system.createLogger('editor').debug('hidden');

    expect(entries.map((entry) => entry.message)).toEqual(['shown', 'also shown']);
  });

  it('TC-FND-003 emits only entries at or above the threshold', () => {
    const { entries, sink } = collectingSink();
    const system = createLoggingSystem({ level: 'warn', sink });
    const log = system.createLogger('ui');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(entries.map((entry) => entry.level)).toEqual(['warn', 'error']);
    expect(entries[0]).toMatchObject({ namespace: 'ui', message: 'w' });
  });

  it('TC-FND-003a writes each level to the matching console method', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const system = createLoggingSystem({ level: 'debug', sink: consoleSink });
    const log = system.createLogger('sync');

    log.debug('one');
    log.info('two', { bytes: 3 });
    log.warn('three');
    log.error('four');

    expect(debug).toHaveBeenCalledWith('[sync] one');
    expect(info).toHaveBeenCalledWith('[sync] two', { bytes: 3 });
    expect(warn).toHaveBeenCalledWith('[sync] three');
    expect(error).toHaveBeenCalledWith('[sync] four');
  });

  it('TC-FND-003b emits nothing when the threshold is silent', () => {
    const { entries, sink } = collectingSink();
    const system = createLoggingSystem({ level: 'silent', sink });

    system.createLogger('ui').error('boom');

    expect(entries).toHaveLength(0);
  });

  it('TC-FND-003c routes module-level loggers to the system configured at call time', () => {
    const log = createLogger('storage');
    const first = collectingSink();
    const second = collectingSink();

    configureLogging({ level: 'debug', sink: first.sink });
    log.debug('a');
    log.info('b');
    configureLogging({ level: 'warn', sink: second.sink });
    log.info('hidden');
    log.warn('c');
    log.error('d');

    expect(first.entries.map((entry) => entry.message)).toEqual(['a', 'b']);
    expect(second.entries.map((entry) => entry.message)).toEqual(['c', 'd']);
  });

  it('TC-FND-004 enables debug for every namespace with ?debug=1', () => {
    const { entries, sink } = collectingSink();

    const system = initLoggingFromUrl('?debug=1', { sink });
    system.createLogger('editor').debug('hello');

    expect(system.getThreshold('editor')).toBe('debug');
    expect(system.getThreshold('anything-else')).toBe('debug');
    expect(system.isBufferEnabled).toBe(true);
    expect(entries).toHaveLength(1);
  });

  it('TC-FND-004a treats ?debug, ?debug=true and ?debug=1 as all namespaces', () => {
    expect(parseDebugParam('?debug')).toBe('all');
    expect(parseDebugParam('?debug=true')).toBe('all');
    expect(parseDebugParam('?other=x&debug=1')).toBe('all');
  });

  it('TC-FND-004b leaves debug off for ?debug=0, ?debug=false and no flag', () => {
    const system = initLoggingFromUrl('', { sink: () => undefined });

    expect(parseDebugParam('?debug=0')).toBeNull();
    expect(parseDebugParam('?debug=false')).toBeNull();
    expect(parseDebugParam('')).toBeNull();
    expect(system.getThreshold('editor')).toBe('warn');
    expect(system.isBufferEnabled).toBe(false);
  });

  it('TC-FND-007 limits debug output to the listed namespaces', () => {
    const { entries, sink } = collectingSink();
    const system = initLoggingFromUrl('?debug=playground,%20sync', { sink });

    system.createLogger('playground').debug('boot');
    system.createLogger('sync').debug('write');
    system.createLogger('editor').debug('hidden');
    system.createLogger('editor').warn('shown');

    expect(parseDebugParam('?debug=playground,%20sync')).toEqual(['playground', 'sync']);
    expect(entries.map((entry) => `${entry.namespace}:${entry.message}`)).toEqual([
      'playground:boot',
      'sync:write',
      'editor:shown',
    ]);
  });

  it('TC-FND-008 keeps only the newest 1,000 entries in the buffer', () => {
    const system = initLoggingFromUrl('?debug=1', { sink: () => undefined });
    const log = system.createLogger('fs');

    for (let index = 0; index < 1_005; index += 1) {
      log.debug(`entry ${String(index)}`);
    }

    expect(system.buffer).toHaveLength(1_000);
    expect(system.buffer[0]?.message).toBe('entry 5');
    expect(system.buffer.at(-1)?.message).toBe('entry 1004');
  });

  it('TC-FND-008a never lets a failing sink break the caller', () => {
    const system = createLoggingSystem({
      level: 'debug',
      sink: () => {
        throw new Error('sink failed');
      },
    });

    expect(() => {
      system.createLogger('ui').info('still fine');
    }).not.toThrow();
  });
});
