/**
 * `npm run playground:remote:build`: builds the WordPress Playground remote (`remote.html`, the PHP WebAssembly
 * builds, WordPress and the service worker) at the upstream tag that matches the pinned `@wp-playground/client`, into
 * `scripts/.cache/playground-remote/<version>/` (gitignored). E2E serves it so tests never depend on
 * playground.wordpress.net (docs/adr/0003-self-hosted-playground-remote-for-tests.md).
 *
 * Upstream needs Node 24 to build: switch to it (for example `nvm use 24`) before running this script.
 * Pass `--force` to rebuild a version that is already in the cache.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { remotePlan, UPSTREAM_REPOSITORY } from './playground-remote/plan';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Where upstream's `npm run build:website` writes the static site, relative to the clone. */
const UPSTREAM_DIST = join('dist', 'packages', 'playground', 'wasm-wordpress-net');
/** Upstream's `engines` at the pinned tag, enforced by its `engine-strict` `.npmrc`. */
const MIN_NODE = [24, 18] as const;

function run(command: string, args: readonly string[], cwd: string): void {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error !== undefined) {
    throw new Error(`${command} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${String(result.status)}`);
  }
}

async function main(): Promise<void> {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const plan = remotePlan(pkg.dependencies['@wp-playground/client'] ?? '', ROOT, tmpdir());

  if (existsSync(join(plan.outDir, 'remote.html')) && !process.argv.includes('--force')) {
    console.log(`Playground remote ${plan.version} is already built in ${plan.outDir}`);
    return;
  }
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  if (major < MIN_NODE[0] || (major === MIN_NODE[0] && minor < MIN_NODE[1])) {
    throw new Error(
      `Building the Playground remote needs Node ${MIN_NODE.join('.')} or later (upstream's requirement); this is Node ${process.versions.node}. Switch Node (for example \`nvm install 24 && nvm use 24\`) and run it again.`,
    );
  }

  await rm(plan.sourceDir, { recursive: true, force: true });
  run(
    'git',
    [
      'clone',
      '--quiet',
      '--branch',
      plan.tag,
      '--single-branch',
      '--depth',
      '1',
      '--recurse-submodules',
      '--shallow-submodules',
      UPSTREAM_REPOSITORY,
      plan.sourceDir,
    ],
    ROOT,
  );
  run('npm', ['ci', '--no-audit', '--no-fund'], plan.sourceDir);
  run('npm', ['run', 'build:website'], plan.sourceDir);

  // Copy next to the target and rename, so an interrupted copy never looks like a finished build.
  const partial = `${plan.outDir}.partial`;
  await rm(partial, { recursive: true, force: true });
  await cp(join(plan.sourceDir, UPSTREAM_DIST), partial, { recursive: true });
  await rm(plan.outDir, { recursive: true, force: true });
  await rename(partial, plan.outDir);
  // The clone and its node_modules take several GB; only the built site is needed.
  await rm(plan.sourceDir, { recursive: true, force: true });
  console.log(`Built Playground remote ${plan.version} into ${plan.outDir}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
