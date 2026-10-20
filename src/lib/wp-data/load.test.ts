import { describe, expect, it, vi } from 'vitest';

import { createWordPressDataLoader, FUNCTIONS_URL, HOOKS_URL } from './load';

const FUNCTIONS = {
  source: { name: 'stubs', version: 'v7.1.2', url: 'u', licence: 'MIT' },
  functions: [{ name: 'get_option', signature: '( $option )', summary: 'Gets.', params: [] }],
};
const HOOKS = {
  source: { name: 'hooks', version: '1.13.0', url: 'u', licence: 'GPL-3.0-or-later' },
  hooks: [{ name: 'init', type: 'action', summary: 'Fires.', params: [] }],
};

function fakeFetch(files: Record<string, unknown>) {
  return vi.fn((url: URL): Promise<unknown> => {
    const file = files[url.pathname.split('/').at(-1) ?? ''];
    return file === undefined ? Promise.reject(new Error('404 Not Found')) : Promise.resolve(file);
  });
}

describe('createWordPressDataLoader', () => {
  it('TC-ED-018 loads both files once and caches the result', async () => {
    const fetchJson = fakeFetch({ 'wp-functions.json': FUNCTIONS, 'wp-hooks.json': HOOKS });
    const load = createWordPressDataLoader(fetchJson);

    const [first, second] = await Promise.all([load(), load()]);
    const third = await load();

    expect(first).toEqual({
      ok: true,
      value: { functions: FUNCTIONS.functions, hooks: HOOKS.hooks },
    });
    expect(second).toBe(first);
    expect(third).toEqual(first);
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(fetchJson.mock.calls.map(([url]) => url)).toEqual([FUNCTIONS_URL, HOOKS_URL]);
  });

  it('TC-ED-018a reports a network failure as a value and retries on the next call', async () => {
    const files: Record<string, unknown> = { 'wp-functions.json': FUNCTIONS };
    const fetchJson = fakeFetch(files);
    const load = createWordPressDataLoader(fetchJson);

    const failed = await load();
    files['wp-hooks.json'] = HOOKS;
    const recovered = await load();

    expect(failed).toEqual({ ok: false, error: { kind: 'network', message: '404 Not Found' } });
    expect(recovered.ok).toBe(true);
    expect(fetchJson).toHaveBeenCalledTimes(4);
  });

  it('TC-ED-018b rejects files with the wrong shape', async () => {
    const load = createWordPressDataLoader(
      fakeFetch({ 'wp-functions.json': { functions: 'nope' }, 'wp-hooks.json': HOOKS }),
    );

    const result = await load();

    expect(result).toMatchObject({ ok: false, error: { kind: 'invalid' } });
  });
});
