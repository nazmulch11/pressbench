/**
 * `npm run playground:remote:serve`: serves the remote built by `npm run playground:remote:build` for the pinned
 * `@wp-playground/client` on http://127.0.0.1:5400. Playwright starts it next to the preview server.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LOCAL_REMOTE_HOST,
  LOCAL_REMOTE_PORT,
  LOCAL_REMOTE_URL,
  remotePlan,
} from './playground-remote/plan';
import { createRemoteServer } from './playground-remote/serve';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main(): Promise<void> {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const plan = remotePlan(pkg.dependencies['@wp-playground/client'] ?? '', ROOT, tmpdir());
  if (!existsSync(join(plan.outDir, 'remote.html'))) {
    throw new Error(
      `No Playground remote ${plan.version} in ${plan.outDir}. Build it once under Node 24 with: npm run playground:remote:build`,
    );
  }
  const server = createRemoteServer(plan.outDir);
  server.listen(LOCAL_REMOTE_PORT, LOCAL_REMOTE_HOST, () => {
    console.log(`Playground remote ${plan.version} at ${LOCAL_REMOTE_URL}`);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
