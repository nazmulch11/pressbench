import { createLogger } from '@/lib/logger';
import { err, ok, type Result } from '@/lib/result';

import type { WordPressData, WordPressFunctionsFile, WordPressHooksFile } from './types';

const log = createLogger('editor');

/** Why the data could not be loaded. */
export interface LoadError {
  readonly kind: 'network' | 'invalid';
  readonly message: string;
}

/** Fetches a URL and parses it as JSON. Replaced in tests. */
export type FetchJson = (url: URL) => Promise<unknown>;

/**
 * The generated files are referenced as assets, not imported: TypeScript would otherwise infer a type from a
 * megabyte of JSON, and the bytes would land in a script chunk instead of a plain, cacheable file.
 */
export const FUNCTIONS_URL = new URL('../../data/wp-functions.json', import.meta.url);
export const HOOKS_URL = new URL('../../data/wp-hooks.json', import.meta.url);

async function fetchJsonFromNetwork(url: URL): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${String(response.status)} ${response.statusText}`);
  }
  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasSource(value: Record<string, unknown>): boolean {
  return isRecord(value.source) && typeof value.source.version === 'string';
}

function isFunctionsFile(value: unknown): value is WordPressFunctionsFile {
  return isRecord(value) && hasSource(value) && Array.isArray(value.functions);
}

function isHooksFile(value: unknown): value is WordPressHooksFile {
  return isRecord(value) && hasSource(value) && Array.isArray(value.hooks);
}

/**
 * Creates a loader for both data files. The first successful load is cached; a failed load is not, so the
 * next call tries again. Errors come back as values.
 */
export function createWordPressDataLoader(
  fetchJson: FetchJson = fetchJsonFromNetwork,
): () => Promise<Result<WordPressData, LoadError>> {
  let cached: WordPressData | null = null;
  let inFlight: Promise<Result<WordPressData, LoadError>> | null = null;

  const load = async (): Promise<Result<WordPressData, LoadError>> => {
    let files: [unknown, unknown];
    try {
      files = await Promise.all([fetchJson(FUNCTIONS_URL), fetchJson(HOOKS_URL)]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn('WordPress data could not be fetched', { message });
      return err({ kind: 'network', message });
    }
    const [functions, hooks] = files;
    if (!isFunctionsFile(functions) || !isHooksFile(hooks)) {
      log.warn('WordPress data has an unexpected shape');
      return err({
        kind: 'invalid',
        message: 'The WordPress data files have an unexpected shape.',
      });
    }
    cached = { functions: functions.functions, hooks: hooks.hooks };
    log.debug('WordPress data loaded', {
      functions: functions.functions.length,
      hooks: hooks.hooks.length,
      stubs: functions.source.version,
      hooksPackage: hooks.source.version,
    });
    return ok(cached);
  };

  return async () => {
    if (cached !== null) {
      return ok(cached);
    }
    inFlight ??= load().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

/** The app-wide loader over `fetch`. */
export const loadWordPressData = createWordPressDataLoader();
