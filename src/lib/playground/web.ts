import type { PlaygroundClient } from '@wp-playground/client';

import { createLogger } from '@/lib/logger';

import { createPlaygroundService, type Connection, type PersistenceReport } from './service';
import { PERSISTENT_DIR, type BootOptions, type PlaygroundService } from './types';

const log = createLogger('playground');

/**
 * The hosted remote. Self-hosting needs a build of the Playground monorepo; the npm package only ships type
 * declarations. See docs/adr/0001-browser-first-on-playground.md.
 */
export const DEFAULT_REMOTE_URL = 'https://playground.wordpress.net/remote.html';

/** Where `PERSISTENT_DIR` lives inside the browser's origin-private file system. */
const OPFS_PATH = '/pressbench/spike';

/** Cold boots download WordPress and PHP; give a slow connection a fair chance before giving up. */
export const DEFAULT_BOOT_TIMEOUT_MS = 120_000;

/** Options for the browser service. */
export interface WebServiceOptions {
  readonly remoteUrl?: string;
  /** Called with the raw client once connected; debug mode exposes it on `window.__PRESSBENCH__.playground`. */
  readonly onClientConnected?: (client: PlaygroundClient) => void;
  /** How long `boot()` waits for the remote before failing. Defaults to `DEFAULT_BOOT_TIMEOUT_MS`. */
  readonly bootTimeoutMs?: number;
}

/** Rejects when `promise` has not settled within `ms`. The remote shows its own error page but never rejects. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `WordPress did not start within ${String(Math.round(ms / 1000))} s. Check the network and try again.`,
        ),
      );
    }, ms);
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
  });
}

async function startClient(
  boot: BootOptions,
  options: WebServiceOptions,
): Promise<PlaygroundClient> {
  const { iframe } = boot;
  if (iframe === undefined) {
    throw new Error('An iframe is required to start WordPress in the browser');
  }
  const versions = boot.versions ?? {};
  // Loaded on demand: the client is ~1 MB and must not be in the initial bundle (Phase 9 budget).
  const { startPlaygroundWeb } = await import('@wp-playground/client');
  const client = await startPlaygroundWeb({
    iframe,
    remoteUrl: options.remoteUrl ?? DEFAULT_REMOTE_URL,
    blueprint: {
      preferredVersions: { php: versions.php ?? 'latest', wp: versions.wp ?? 'latest' },
      login: true,
      landingPage: '/',
      features: { networking: false },
    },
    ...(options.onClientConnected === undefined
      ? {}
      : { onClientConnected: options.onClientConnected }),
  });
  await client.isReady();
  return client;
}

async function connect(boot: BootOptions, options: WebServiceOptions): Promise<Connection> {
  const client = await withTimeout(
    startClient(boot, options),
    options.bootTimeoutMs ?? DEFAULT_BOOT_TIMEOUT_MS,
  );

  let persistence: PersistenceReport = { mode: 'off' };
  let flushPersistentDir: (() => Promise<void>) | undefined;
  if (boot.persist === true) {
    try {
      await client.mkdirTree(PERSISTENT_DIR);
      await client.mountOpfs({
        mountpoint: PERSISTENT_DIR,
        device: { type: 'opfs', path: OPFS_PATH },
        initialSyncDirection: 'opfs-to-memfs',
      });
      log.debug('persistent dir mounted', { dir: PERSISTENT_DIR });
      persistence = { mode: 'on' };
      flushPersistentDir = () => client.flushOpfs(PERSISTENT_DIR);
    } catch (error: unknown) {
      // WebKit refuses OPFS inside the cross-origin Playground iframe. WordPress still runs; say so and go on.
      const reason = error instanceof Error ? error.message : String(error);
      log.warn('persistent dir could not be mounted', { reason });
      persistence = { mode: 'unavailable', reason };
      flushPersistentDir = () =>
        Promise.reject(new Error(`Files are not kept in this browser: ${reason}`));
    }
  }

  return {
    php: client,
    web: {
      goTo: (path) => client.goTo(path),
      getCurrentUrl: () => client.getCurrentURL(),
      ...(flushPersistentDir === undefined ? {} : { flushPersistentDir }),
    },
    persistence,
  };
}

/** Creates the service that runs WordPress inside an iframe in the browser. */
export function createWebPlaygroundService(options: WebServiceOptions = {}): PlaygroundService {
  return createPlaygroundService({ connect: (boot) => connect(boot, options) });
}
