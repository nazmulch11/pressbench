/**
 * `npm run generate:wp-data`: builds `src/data/wp-functions.json` (from php-stubs/wordpress-stubs at the tag
 * pinned in `scripts/wp-data/sources.ts`) and `src/data/wp-hooks.json` (from the installed
 * `@wp-hooks/wordpress-core`) for editor completion and hover docs.
 *
 * The stubs are a Composer package, so the file is downloaded once from GitHub into `scripts/.cache/`
 * (gitignored). Pass `--stubs <path>` to use a local copy instead, for example offline.
 *
 * Never edit the generated files by hand; change the parser or the pins and rerun.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { convertHooks, type HooksJson } from './wp-data/hooks';
import { parseStubs } from './wp-data/parse-stubs';
import {
  HOOKS_PACKAGE,
  hooksSource,
  STUBS_DOWNLOAD_URL,
  STUBS_SHA256,
  STUBS_SOURCE,
  STUBS_VERSION,
  wordpressVersionFromReadme,
} from './wp-data/sources';
import { toDataFile } from './wp-data/write-json';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'scripts', '.cache');
const DATA_DIR = join(ROOT, 'src', 'data');
const require = createRequire(import.meta.url);

async function stubsPath(args: readonly string[]): Promise<string> {
  const flag = args.indexOf('--stubs');
  const explicit = flag === -1 ? undefined : args[flag + 1];
  if (explicit !== undefined) {
    return explicit;
  }
  const cached = join(CACHE_DIR, `wordpress-stubs-${STUBS_VERSION}.php`);
  if (!existsSync(cached)) {
    console.log(`Downloading ${STUBS_DOWNLOAD_URL} …`);
    const response = await fetch(STUBS_DOWNLOAD_URL);
    if (!response.ok) {
      throw new Error(`Download failed: ${String(response.status)} ${response.statusText}`);
    }
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cached, await response.text());
  }
  return cached;
}

/** A `--stubs` file is trusted as given; the downloaded tag must match the pinned checksum. */
function verifyChecksum(source: string, path: string): void {
  if (path.startsWith(CACHE_DIR)) {
    const actual = createHash('sha256').update(source).digest('hex');
    if (actual !== STUBS_SHA256) {
      throw new Error(
        `${path} has SHA-256 ${actual}, expected ${STUBS_SHA256}. Update STUBS_SHA256 in scripts/wp-data/sources.ts if the tag was changed on purpose.`,
      );
    }
  }
}

async function generateFunctions(args: readonly string[]): Promise<number> {
  const path = await stubsPath(args);
  const source = await readFile(path, 'utf8');
  verifyChecksum(source, path);
  const functions = parseStubs(source).sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(
    join(DATA_DIR, 'wp-functions.json'),
    toDataFile({ source: STUBS_SOURCE }, 'functions', functions),
  );
  return functions.length;
}

async function generateHooks(): Promise<number> {
  const packageDir = dirname(require.resolve(`${HOOKS_PACKAGE}/package.json`));
  const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as {
    version: string;
  };
  const readme = await readFile(join(packageDir, 'readme.md'), 'utf8');
  const actions = JSON.parse(
    await readFile(join(packageDir, 'hooks', 'actions.json'), 'utf8'),
  ) as HooksJson;
  const filters = JSON.parse(
    await readFile(join(packageDir, 'hooks', 'filters.json'), 'utf8'),
  ) as HooksJson;
  const hooks = convertHooks(actions, filters);
  await writeFile(
    join(DATA_DIR, 'wp-hooks.json'),
    toDataFile(
      { source: hooksSource(manifest.version, wordpressVersionFromReadme(readme)) },
      'hooks',
      hooks,
    ),
  );
  return hooks.length;
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const functionCount = await generateFunctions(args);
  console.log(
    `src/data/wp-functions.json: ${String(functionCount)} functions from ${STUBS_VERSION}`,
  );
  const hookCount = await generateHooks();
  console.log(`src/data/wp-hooks.json: ${String(hookCount)} hooks from ${HOOKS_PACKAGE}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
