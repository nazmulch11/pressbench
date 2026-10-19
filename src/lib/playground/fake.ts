import { err, ok, type Result } from '@/lib/result';

import {
  DEFAULT_VERSIONS,
  type BootOptions,
  type PhpRunResult,
  type PlaygroundError,
  type PlaygroundService,
  type PlaygroundState,
  type ReadyInfo,
  type RequestedVersions,
} from './types';

/** Knobs for `createFakePlaygroundService`. */
export interface FakeServiceOptions {
  /** When set, `boot()` fails with this message until `bootError` is cleared. */
  readonly bootError?: string;
  /** `manual` keeps the service in `booting` until `finishBoot()` or `failBoot()` is called. */
  readonly boot?: 'auto' | 'manual';
  /** When set, booting with `persist` reports persistence as unavailable for this reason. */
  readonly persistenceUnavailable?: string;
}

/**
 * In-memory stand-in for the real service. Files live in a map. `run` understands `<?php echo '<literal>';`
 * and `<?php echo "<literal>";`; every other snippet returns what `whenRun` registered, or an empty ok result.
 */
export interface FakePlaygroundService extends PlaygroundService {
  bootError: string | null;
  readonly lastBootOptions: BootOptions | undefined;
  readonly files: ReadonlyMap<string, string>;
  whenRun(code: string, result: PhpRunResult): void;
  /** Completes a pending manual boot. */
  finishBoot(): void;
  /** Fails a pending manual boot. */
  failBoot(message: string): void;
}

const ECHO_LITERAL = /^<\?php\s*echo\s*(['"])(.*?)\1\s*;\s*$/s;
const NOT_BOOTED: PlaygroundError = { kind: 'not-booted', message: 'WordPress is not running' };

/** Creates the in-memory fake. See `FakePlaygroundService` for what it does and does not emulate. */
export function createFakePlaygroundService(
  options: FakeServiceOptions = {},
): FakePlaygroundService {
  const files = new Map<string, string>();
  const scripted = new Map<string, PhpRunResult>();
  const listeners = new Set<(state: PlaygroundState) => void>();
  let state: PlaygroundState = { status: 'idle' };
  let ready = false;
  let versions: RequestedVersions = DEFAULT_VERSIONS;
  let lastBootOptions: BootOptions | undefined;
  let pendingBoot: { settle(result: Result<ReadyInfo, PlaygroundError>): void } | undefined;

  function readyInfo(persist: boolean | undefined): ReadyInfo {
    if (persist !== true) {
      return { bootMs: 0, versions, persistence: 'off' };
    }
    if (options.persistenceUnavailable !== undefined) {
      return {
        bootMs: 0,
        versions,
        persistence: 'unavailable',
        persistenceReason: options.persistenceUnavailable,
      };
    }
    return { bootMs: 0, versions, persistence: 'on' };
  }

  function setState(next: PlaygroundState): void {
    state = next;
    for (const listener of listeners) {
      listener(state);
    }
  }

  function guard<T>(value: () => Result<T, PlaygroundError>): Promise<Result<T, PlaygroundError>> {
    return Promise.resolve(ready ? value() : err(NOT_BOOTED));
  }

  function completeBoot(result: Result<ReadyInfo, PlaygroundError>): void {
    if (result.ok) {
      ready = true;
      setState({ status: 'ready', ...result.value });
    } else {
      setState({ status: 'error', error: result.error });
    }
  }

  const service: FakePlaygroundService = {
    bootError: options.bootError ?? null,
    get state() {
      return state;
    },
    get lastBootOptions() {
      return lastBootOptions;
    },
    files,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    boot(bootOptions = {}) {
      lastBootOptions = bootOptions;
      versions = { ...DEFAULT_VERSIONS, ...bootOptions.versions };
      ready = false;
      setState({ status: 'booting' });
      const outcome: Result<ReadyInfo, PlaygroundError> =
        service.bootError === null
          ? ok(readyInfo(bootOptions.persist))
          : err({ kind: 'boot-failed', message: service.bootError });
      if (options.boot === 'manual') {
        return new Promise((resolve) => {
          pendingBoot = {
            settle(result) {
              pendingBoot = undefined;
              completeBoot(result);
              resolve(result);
            },
          };
        });
      }
      completeBoot(outcome);
      return Promise.resolve(outcome);
    },

    finishBoot() {
      pendingBoot?.settle(ok(readyInfo(lastBootOptions?.persist)));
    },

    failBoot(message) {
      pendingBoot?.settle(err({ kind: 'boot-failed', message }));
    },

    whenRun(code, result) {
      scripted.set(code, result);
    },

    run(code) {
      return guard(() => {
        const registered = scripted.get(code);
        if (registered !== undefined) {
          return registered;
        }
        const literal = ECHO_LITERAL.exec(code)?.[2] ?? '';
        return ok({ output: literal, stderr: '', exitCode: 0 });
      });
    },

    writeFile(path, content) {
      return guard(() => {
        files.set(path, content);
        return ok(undefined);
      });
    },

    readFile(path) {
      return guard(() => {
        const content = files.get(path);
        return content === undefined
          ? err({ kind: 'io', message: `${path} does not exist` })
          : ok(content);
      });
    },

    fileExists(path) {
      return guard(() => ok(files.has(path)));
    },

    listFiles(directory) {
      return guard(() => {
        const prefix = directory.endsWith('/') ? directory : `${directory}/`;
        const names = new Set<string>();
        for (const path of files.keys()) {
          if (path.startsWith(prefix)) {
            names.add(path.slice(prefix.length).split('/')[0] ?? '');
          }
        }
        return ok([...names]);
      });
    },

    activatePlugin(pluginFile) {
      return guard(() =>
        files.has(`/wordpress/wp-content/plugins/${pluginFile}`)
          ? ok(undefined)
          : err({ kind: 'php-error', message: `Plugin file does not exist: ${pluginFile}` }),
      );
    },

    getVersions() {
      return guard(() => ok(versions));
    },

    request(path) {
      return guard(() => ok({ status: 200, body: `<!-- fake response for ${path} -->` }));
    },

    goTo() {
      return guard(() => ok(undefined));
    },

    getCurrentUrl() {
      return guard(() => ok('https://playground.test/'));
    },

    persist() {
      return guard(() => ok(undefined));
    },

    dispose() {
      ready = false;
      setState({ status: 'idle' });
      return Promise.resolve();
    },
  };

  return service;
}
