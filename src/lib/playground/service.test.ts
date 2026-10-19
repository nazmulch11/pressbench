import { describe, expect, it, vi } from 'vitest';

import { PLAYGROUND_SERVICE_CONTRACT } from '@/test/playground-contract';

import type { PhpResponseLike } from './run-php';
import { createPlaygroundService, type Connection, type PhpClient } from './service';

const encoder = new TextEncoder();

function response(output: string, exitCode = 0, errors = ''): PhpResponseLike {
  return { bytes: encoder.encode(output), errors, exitCode };
}

/**
 * Enough of a Playground client to drive the service: files in a map, and `run` answering the snippets the
 * service sends (versions, plugin activation) plus `echo` of a literal.
 */
function fakePhpClient(
  files = new Map<string, string>(),
): PhpClient & { files: Map<string, string> } {
  return {
    files,
    run: ({ code }) => {
      if (code.includes("get_bloginfo( 'version' )")) {
        return Promise.resolve(response(JSON.stringify({ wp: '6.8.2', php: '8.3.33' })));
      }
      const activation = /activate_plugin\( '([^']+)' \)/.exec(code);
      if (activation !== null) {
        const exists = files.has(`/wordpress/wp-content/plugins/${activation[1] ?? ''}`);
        return Promise.resolve(
          response(JSON.stringify({ error: exists ? null : 'Plugin file does not exist.' })),
        );
      }
      const literal = /echo\s*'([^']*)'/.exec(code)?.[1] ?? '';
      return Promise.resolve(response(literal));
    },
    writeFile: (path, data) => {
      files.set(path, data);
      return Promise.resolve();
    },
    readFileAsText: (path) => {
      const content = files.get(path);
      return content === undefined
        ? Promise.reject(new Error(`ENOENT: ${path}`))
        : Promise.resolve(content);
    },
    fileExists: (path) => Promise.resolve(files.has(path)),
    mkdirTree: () => Promise.resolve(),
    listFiles: (directory) =>
      Promise.resolve(
        [...files.keys()]
          .filter((path) => path.startsWith(`${directory}/`))
          .map((path) => path.slice(directory.length + 1)),
      ),
    request: ({ url }) =>
      Promise.resolve({ ...response(`<html>${url}</html>`), httpStatusCode: 200 }),
  };
}

function serviceOver(connection: Partial<Connection> = {}, now?: () => number) {
  const php = fakePhpClient();
  const service = createPlaygroundService({
    connect: () => Promise.resolve({ php, ...connection }),
    ...(now === undefined ? {} : { now }),
  });
  return { service, php };
}

describe('createPlaygroundService', () => {
  for (const contractCase of PLAYGROUND_SERVICE_CONTRACT) {
    it(`TC-PG-009${contractCase.suffix} ${contractCase.name} (service core)`, async () => {
      const { service } = serviceOver();

      await expect(contractCase.run(service)).resolves.toBeUndefined();
    });
  }

  it('TC-PG-014a measures the boot time and reports the versions WordPress gives', async () => {
    const clock = vi.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(3_500);
    const { service } = serviceOver({}, clock);

    const result = await service.boot({ versions: { wp: '6.8', php: '8.3' } });

    expect(result).toEqual({
      ok: true,
      value: { bootMs: 2_500, versions: { wp: '6.8.2', php: '8.3.33' }, persistence: 'off' },
    });
    expect(service.state).toEqual({
      status: 'ready',
      bootMs: 2_500,
      versions: { wp: '6.8.2', php: '8.3.33' },
      persistence: 'off',
    });
  });

  it('TC-PG-014b turns a rejected connection into a boot-failed error state', async () => {
    const service = createPlaygroundService({
      connect: () => Promise.reject(new Error('remote.html timed out')),
    });

    const result = await service.boot();

    expect(result).toEqual({
      ok: false,
      error: { kind: 'boot-failed', message: 'remote.html timed out' },
    });
    expect(service.state).toEqual({
      status: 'error',
      error: { kind: 'boot-failed', message: 'remote.html timed out' },
    });
  });

  it('TC-PG-014c activates an existing plugin and reports a missing one', async () => {
    const { service } = serviceOver();
    await service.boot();
    await service.writeFile('/wordpress/wp-content/plugins/hello/hello.php', '<?php');

    const activated = await service.activatePlugin('hello/hello.php');
    const missing = await service.activatePlugin('nope/missing.php');

    expect(activated).toEqual({ ok: true, value: undefined });
    expect(missing).toEqual({
      ok: false,
      error: { kind: 'php-error', message: 'Plugin file does not exist.' },
    });
  });

  it('TC-PG-014d reports PHP output that is not the expected JSON', async () => {
    const { service, php } = serviceOver();
    await service.boot();
    php.run = () => Promise.resolve(response('<b>Warning</b>: oops'));

    const result = await service.getVersions();

    expect(result).toMatchObject({ ok: false, error: { kind: 'unknown' } });
  });

  it('TC-PG-014e answers HTTP requests through the client', async () => {
    const { service } = serviceOver();
    await service.boot();

    const result = await service.request('/wp-admin/');

    expect(result).toEqual({ ok: true, value: { status: 200, body: '<html>/wp-admin/</html>' } });
  });

  it('TC-PG-014f reports navigation as unsupported without a browser connection', async () => {
    const { service } = serviceOver();
    expect(await service.goTo('/')).toEqual({
      ok: false,
      error: { kind: 'not-booted', message: 'WordPress is not running' },
    });
    await service.boot();

    const goTo = await service.goTo('/wp-admin/');
    const url = await service.getCurrentUrl();
    const persisted = await service.persist();

    expect(goTo).toMatchObject({ ok: false, error: { kind: 'unknown' } });
    expect(url).toMatchObject({ ok: false, error: { kind: 'unknown' } });
    expect(persisted).toEqual({ ok: true, value: undefined });
  });

  it('TC-PG-014g uses the browser extras for navigation and persistence', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const { service } = serviceOver({
      web: {
        goTo: vi.fn().mockResolvedValue(undefined),
        getCurrentUrl: vi.fn().mockResolvedValue('https://playground.test/wp-admin/'),
        flushPersistentDir: flush,
      },
    });
    await service.boot();

    expect(await service.goTo('/wp-admin/')).toEqual({ ok: true, value: undefined });
    expect(await service.getCurrentUrl()).toEqual({
      ok: true,
      value: 'https://playground.test/wp-admin/',
    });
    expect(await service.persist()).toEqual({ ok: true, value: undefined });
    expect(flush).toHaveBeenCalledOnce();
  });

  it('TC-PG-014h maps a failing browser extra to an error value', async () => {
    const { service } = serviceOver({
      web: {
        goTo: () => Promise.reject(new Error('iframe gone')),
        getCurrentUrl: () => Promise.reject(new Error('iframe gone')),
        flushPersistentDir: () => Promise.reject(new Error('quota exceeded')),
      },
    });
    await service.boot();

    expect(await service.goTo('/')).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'iframe gone' },
    });
    expect(await service.getCurrentUrl()).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'iframe gone' },
    });
    expect(await service.persist()).toEqual({
      ok: false,
      error: { kind: 'unknown', message: 'quota exceeded' },
    });
  });

  it('TC-PG-014i disposes the connection it was given', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);
    const { service } = serviceOver({ dispose });
    await service.boot();

    await service.dispose();

    expect(dispose).toHaveBeenCalledOnce();
    expect(service.state).toEqual({ status: 'idle' });
  });

  it('TC-PG-014k carries the persistence report of the connection into the ready state', async () => {
    const { service } = serviceOver({
      persistence: { mode: 'unavailable', reason: 'no storage in this context' },
    });

    const result = await service.boot({ persist: true });

    expect(result).toMatchObject({
      ok: true,
      value: { persistence: 'unavailable', persistenceReason: 'no storage in this context' },
    });
  });

  it('TC-PG-014l refuses a boot while booting and disposes the previous connection on reboot', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);
    const releases: (() => void)[] = [];
    const php = fakePhpClient();
    const service = createPlaygroundService({
      connect: () =>
        new Promise((resolve) => {
          releases.push(() => {
            resolve({ php, dispose });
          });
        }),
    });

    const first = service.boot();
    const whileBooting = await service.boot();
    await vi.waitFor(() => {
      expect(releases).toHaveLength(1);
    });
    releases[0]?.();
    await first;
    const second = service.boot();
    await vi.waitFor(() => {
      expect(releases).toHaveLength(2);
    });
    releases[1]?.();
    await second;

    expect(whileBooting).toEqual({
      ok: false,
      error: { kind: 'boot-failed', message: 'WordPress is already starting' },
    });
    expect(dispose).toHaveBeenCalledOnce();
    expect(service.state.status).toBe('ready');
  });

  it('TC-PG-014m creates only the parent folder of the file it writes', async () => {
    const { service, php } = serviceOver();
    const mkdirTree = vi.spyOn(php, 'mkdirTree');
    await service.boot();

    await service.writeFile('/wordpress/wp-content/plugins/hello/hello.php', '<?php');
    await service.writeFile('bare.txt', 'x');

    expect(mkdirTree).toHaveBeenCalledTimes(1);
    expect(mkdirTree).toHaveBeenCalledWith('/wordpress/wp-content/plugins/hello');
  });

  it('TC-PG-014j rejects file operations before boot and after dispose', async () => {
    const { service } = serviceOver();
    const notBooted = {
      ok: false,
      error: { kind: 'not-booted', message: 'WordPress is not running' },
    };

    expect(await service.writeFile('/a.txt', 'x')).toEqual(notBooted);
    expect(await service.readFile('/a.txt')).toEqual(notBooted);
    expect(await service.fileExists('/a.txt')).toEqual(notBooted);
    expect(await service.listFiles('/')).toEqual(notBooted);
    expect(await service.request('/')).toEqual(notBooted);
    expect(await service.persist()).toEqual(notBooted);
    expect(await service.activatePlugin('a/a.php')).toEqual(notBooted);
  });
});
