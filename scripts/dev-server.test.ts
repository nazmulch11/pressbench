// @vitest-environment node
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const GENERATED = ['coverage', 'playwright-report', 'test-results', 'blob-report'];
const PROBE = '.dev-server-watch-probe.html';

let server: ViteDevServer;
let watched: Record<string, string[]>;

vi.setConfig({ hookTimeout: 30_000 });

beforeAll(async () => {
  // Make sure each folder exists and holds an HTML file, the kind of file whose change makes Vite reload the page.
  for (const folder of GENERATED) {
    mkdirSync(join(ROOT, folder), { recursive: true });
    writeFileSync(join(ROOT, folder, PROBE), '<!doctype html>');
  }
  server = await createServer({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  });
  // The watcher reports "ready" before createServer resolves, but keeps adding folders while it scans. Wait
  // until the list of watched folders has stopped changing for a while.
  let previous = -1;
  let stableChecks = 0;
  await vi.waitFor(
    () => {
      const count = Object.keys(server.watcher.getWatched()).length;
      stableChecks = count === previous ? stableChecks + 1 : 0;
      previous = count;
      if (stableChecks < 5) {
        throw new Error(`watcher still scanning (${String(count)} folders)`);
      }
    },
    { timeout: 20_000, interval: 200 },
  );
  watched = server.watcher.getWatched();
});

afterAll(async () => {
  await server.close();
  for (const folder of GENERATED) {
    rmSync(join(ROOT, folder, PROBE), { force: true });
  }
});

describe('dev server', () => {
  it('TC-FND-011 does not watch generated test reports, so writing them never reloads the app', () => {
    const watchedDirs = Object.keys(watched);

    const generatedWatched = watchedDirs.filter((dir) =>
      GENERATED.some((folder) => {
        const absolute = join(ROOT, folder);
        return dir === absolute || dir.startsWith(`${absolute}/`);
      }),
    );
    const rootEntries = watched[ROOT] ?? [];

    expect(generatedWatched).toEqual([]);
    expect(rootEntries.filter((name) => GENERATED.includes(name))).toEqual([]);
    expect(watchedDirs).toContain(join(ROOT, 'src'));
  });
});
