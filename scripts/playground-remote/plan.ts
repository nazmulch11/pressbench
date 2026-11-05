import { join } from 'node:path';

/**
 * Where E2E serves the local remote. `@wp-playground/client` only accepts a remote on a fixed list of origins;
 * `http://127.0.0.1:5400` (upstream's dev server) is on it. `127.0.0.1` is a different site from the app on
 * `localhost`, so the iframe stays third-party as in production.
 */
export const LOCAL_REMOTE_HOST = '127.0.0.1';
export const LOCAL_REMOTE_PORT = 5400;
export const LOCAL_REMOTE_URL = `http://${LOCAL_REMOTE_HOST}:${String(LOCAL_REMOTE_PORT)}/remote.html`;

/** The public hosts E2E must never contact (TC-PG-017). */
export const PUBLIC_PLAYGROUND_HOSTS = ['playground.wordpress.net', 'wpsandbox.wordpress.net'];

export const UPSTREAM_REPOSITORY = 'https://github.com/WordPress/wordpress-playground.git';

/** What `npm run playground:remote:build` builds and where. */
export interface RemotePlan {
  readonly version: string;
  /** Upstream release tag that matches the pinned `@wp-playground/client`. */
  readonly tag: string;
  /**
   * Shallow clone of the upstream monorepo, outside the project: inside it, TypeScript in upstream's build also
   * loads Pressbench's `node_modules/@types` and fails on duplicate declarations. Removed after a successful build.
   */
  readonly sourceDir: string;
  /** The built static site; `remote.html` sits at its root. */
  readonly outDir: string;
}

/** The remote must come from the same release as the client, so only an exact `x.y.z` pin is accepted. */
export function remotePlan(clientVersion: string, root: string, tempDir: string): RemotePlan {
  if (!/^\d+\.\d+\.\d+$/.test(clientVersion)) {
    throw new Error(
      `@wp-playground/client must be pinned to an exact version to build a matching remote, got "${clientVersion}"`,
    );
  }
  const cache = join(root, 'scripts', '.cache');
  return {
    version: clientVersion,
    tag: `v${clientVersion}`,
    sourceDir: join(tempDir, `pressbench-playground-src-${clientVersion}`),
    outDir: join(cache, 'playground-remote', clientVersion),
  };
}
