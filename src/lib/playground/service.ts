import { createLogger } from '@/lib/logger';
import { err, ok, type Result } from '@/lib/result';

import { decodeBytes, runPhp, type PhpResponseLike, type PhpRunner } from './run-php';
import {
  DEFAULT_VERSIONS,
  PERSISTENT_DIR,
  type BootOptions,
  type HttpResponse,
  type PersistenceMode,
  type PhpRunResult,
  type PlaygroundError,
  type PlaygroundService,
  type PlaygroundState,
  type PlaygroundVersions,
  type ReadyInfo,
} from './types';

const log = createLogger('playground');

/**
 * The subset of the Playground client the service needs. Both the browser client (`@wp-playground/client`) and
 * the Node worker (`@wp-playground/cli`) satisfy it structurally, so one service implementation serves both.
 */
export interface PhpClient extends PhpRunner {
  writeFile(path: string, data: string): Promise<void>;
  readFileAsText(path: string): Promise<string>;
  fileExists(path: string): Promise<boolean>;
  mkdirTree(path: string): Promise<void>;
  listFiles(path: string): Promise<string[]>;
  request(request: { readonly url: string }): Promise<PhpResponseLike & { httpStatusCode: number }>;
}

/** Browser-only abilities. Absent in Node, where the service reports them as unsupported. */
export interface WebClientExtras {
  readonly goTo: (path: string) => Promise<void>;
  readonly getCurrentUrl: () => Promise<string>;
  readonly flushPersistentDir?: () => Promise<void>;
}

/** What the connection found out about `PERSISTENT_DIR` while booting. */
export interface PersistenceReport {
  readonly mode: PersistenceMode;
  readonly reason?: string;
}

/** A live runtime: the PHP client plus, in the browser, navigation and persistence. */
export interface Connection {
  readonly php: PhpClient;
  readonly web?: WebClientExtras;
  /** Defaults to `off`. */
  readonly persistence?: PersistenceReport;
  dispose?(): Promise<void>;
}

/** What `createPlaygroundService` needs from its environment. */
export interface ServiceDependencies {
  /** Boots the runtime and resolves once it is ready. Rejections become `boot-failed` errors. */
  connect(options: BootOptions): Promise<Connection>;
  /** Clock for boot timing; injectable for tests. */
  readonly now?: () => number;
}

interface VersionsPayload {
  readonly wp: string;
  readonly php: string;
}

interface ActivatePayload {
  readonly error: string | null;
}

/** Escapes a string for a single-quoted PHP literal. */
function phpString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ioError(error: unknown): PlaygroundError {
  return { kind: 'io', message: toMessage(error) };
}

const NOT_BOOTED: PlaygroundError = { kind: 'not-booted', message: 'WordPress is not running' };

/**
 * Creates a `PlaygroundService` over a Playground client. See `createWebPlaygroundService` for the browser and
 * `tests/integration/` for Node.
 */
export function createPlaygroundService(deps: ServiceDependencies): PlaygroundService {
  const now = deps.now ?? (() => performance.now());
  const listeners = new Set<(state: PlaygroundState) => void>();
  let state: PlaygroundState = { status: 'idle' };
  let connection: Connection | undefined;

  function setState(next: PlaygroundState): void {
    state = next;
    for (const listener of listeners) {
      listener(state);
    }
  }

  function withClient<T>(
    action: (php: PhpClient) => Promise<T>,
  ): Promise<Result<T, PlaygroundError>> {
    if (connection === undefined) {
      return Promise.resolve(err(NOT_BOOTED));
    }
    return action(connection.php).then(
      (value) => ok(value),
      (error: unknown) => err(ioError(error)),
    );
  }

  async function run(code: string): Promise<PhpRunResult> {
    if (connection === undefined) {
      return err(NOT_BOOTED);
    }
    return runPhp(connection.php, code);
  }

  async function runJson<T>(code: string): Promise<Result<T, PlaygroundError>> {
    const result = await run(code);
    if (!result.ok) {
      return result;
    }
    try {
      return ok(JSON.parse(result.value.output) as T);
    } catch (error: unknown) {
      return err({ kind: 'unknown', message: `Unexpected PHP output: ${toMessage(error)}` });
    }
  }

  async function getVersions(): Promise<Result<PlaygroundVersions, PlaygroundError>> {
    const payload = await runJson<VersionsPayload>(
      "<?php require '/wordpress/wp-load.php'; echo json_encode( array( 'wp' => get_bloginfo( 'version' ), 'php' => PHP_VERSION ) );",
    );
    if (!payload.ok) {
      return payload;
    }
    return ok({ wp: payload.value.wp, php: payload.value.php });
  }

  return {
    get state() {
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async boot(options = {}) {
      if (state.status === 'booting') {
        return err({ kind: 'boot-failed', message: 'WordPress is already starting' });
      }
      const versions = { ...DEFAULT_VERSIONS, ...options.versions };
      const started = now();
      const previous = connection;
      connection = undefined;
      setState({ status: 'booting' });
      log.info('boot requested', { versions, persist: options.persist ?? false });
      try {
        await previous?.dispose?.();
        connection = await deps.connect({ ...options, versions });
      } catch (error: unknown) {
        const failure: PlaygroundError = { kind: 'boot-failed', message: toMessage(error) };
        log.error('boot failed', { message: failure.message });
        setState({ status: 'error', error: failure });
        return err(failure);
      }
      const bootMs = now() - started;
      const reported = await getVersions();
      const persistence = connection.persistence ?? { mode: 'off' };
      const info: ReadyInfo = {
        bootMs,
        versions: reported.ok ? reported.value : versions,
        persistence: persistence.mode,
        ...(persistence.reason === undefined ? {} : { persistenceReason: persistence.reason }),
      };
      log.info('ready', {
        bootMs: Math.round(bootMs),
        versions: info.versions,
        persistence: info.persistence,
      });
      setState({ status: 'ready', ...info });
      return ok(info);
    },

    run,

    writeFile(path, content) {
      return withClient(async (php) => {
        const slash = path.lastIndexOf('/');
        if (slash > 0) {
          await php.mkdirTree(path.slice(0, slash));
        }
        await php.writeFile(path, content);
      });
    },

    readFile(path) {
      return withClient((php) => php.readFileAsText(path));
    },

    fileExists(path) {
      return withClient((php) => php.fileExists(path));
    },

    listFiles(directory) {
      return withClient((php) => php.listFiles(directory));
    },

    async activatePlugin(pluginFile) {
      const payload = await runJson<ActivatePayload>(
        `<?php require '/wordpress/wp-load.php'; require_once ABSPATH . 'wp-admin/includes/plugin.php';
         $result = activate_plugin( ${phpString(pluginFile)} );
         echo json_encode( array( 'error' => is_wp_error( $result ) ? $result->get_error_message() : null ) );`,
      );
      if (!payload.ok) {
        return payload;
      }
      if (payload.value.error !== null) {
        return err({ kind: 'php-error', message: payload.value.error });
      }
      return ok(undefined);
    },

    getVersions,

    request(path) {
      return withClient(async (php): Promise<HttpResponse> => {
        const response = await php.request({ url: path });
        return { status: response.httpStatusCode, body: decodeBytes(response.bytes) };
      });
    },

    goTo(path) {
      const web = connection?.web;
      if (web === undefined) {
        return Promise.resolve(err(connection === undefined ? NOT_BOOTED : unsupported('goTo')));
      }
      return web.goTo(path).then(() => ok(undefined), fail);
    },

    getCurrentUrl() {
      const web = connection?.web;
      if (web === undefined) {
        return Promise.resolve(
          err(connection === undefined ? NOT_BOOTED : unsupported('getCurrentUrl')),
        );
      }
      return web.getCurrentUrl().then(ok, fail);
    },

    persist() {
      if (connection === undefined) {
        return Promise.resolve(err(NOT_BOOTED));
      }
      const flush = connection.web?.flushPersistentDir;
      if (flush === undefined) {
        return Promise.resolve(ok(undefined));
      }
      log.debug('flushing persistent dir', { dir: PERSISTENT_DIR });
      return flush().then(() => ok(undefined), fail);
    },

    async dispose() {
      const current = connection;
      connection = undefined;
      setState({ status: 'idle' });
      await current?.dispose?.();
    },
  };
}

function unsupported(method: string): PlaygroundError {
  return { kind: 'unknown', message: `${method} is only available in the browser` };
}

function fail(error: unknown): Result<never, PlaygroundError> {
  return err({ kind: 'unknown', message: toMessage(error) });
}
