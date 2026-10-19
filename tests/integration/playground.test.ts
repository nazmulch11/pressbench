/**
 * Real PHP (WebAssembly) in Node through @wp-playground/cli, driven through the same service code the browser
 * uses. Boots one WordPress per file; each test gets a fresh service over the shared worker.
 */
import { runCLI, type RunCLIServer } from '@wp-playground/cli';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPlaygroundService, type PlaygroundService } from '@/lib/playground';
import { PLAYGROUND_SERVICE_CONTRACT } from '@/test/playground-contract';

const HELLO_PLUGIN = `<?php
/**
 * Plugin Name: Pressbench Hello
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_notices', 'pressbench_hello_notice' );

function pressbench_hello_notice() {
	echo '<div class="notice notice-success"><p>Hello from Pressbench</p></div>';
}
`;

let server: RunCLIServer;

beforeAll(async () => {
  server = await runCLI({
    command: 'server',
    quiet: true,
    skipBrowser: true,
    login: false,
    php: '8.3',
    port: 0,
  });
});

afterAll(async () => {
  await server[Symbol.asyncDispose]();
});

function serviceOverCli(): PlaygroundService {
  return createPlaygroundService({
    connect: () => Promise.resolve({ php: server.playground }),
  });
}

describe('playground service on real PHP', () => {
  it('TC-PG-003 runs PHP and returns its output', async () => {
    const service = serviceOverCli();
    await service.boot();

    const result = await service.run('<?php echo 2+2;');

    expect(result).toEqual({ ok: true, value: { output: '4', stderr: '', exitCode: 0 } });
  });

  it('TC-PG-004 returns a fatal error as a value with message and line', async () => {
    const service = serviceOverCli();
    await service.boot();

    const result = await service.run('<?php\nundefined_function_xyz();');

    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'php-error',
        message: expect.stringMatching(
          /Call to undefined function undefined_function_xyz\(\).*(?:on line 2|eval\.php:2)/,
        ) as string,
      },
    });
    const exitCode = result.ok ? 0 : result.error.exitCode;
    expect(exitCode).toBeTypeOf('number');
    expect(exitCode).not.toBe(0);
  });

  it('TC-PG-012a activates a plugin that was written into wp-content/plugins', async () => {
    const service = serviceOverCli();
    await service.boot();
    await service.writeFile('/wordpress/wp-content/plugins/hello/hello.php', HELLO_PLUGIN);

    const activated = await service.activatePlugin('hello/hello.php');
    const active = await service.run(
      `<?php require '/wordpress/wp-load.php'; require_once ABSPATH . 'wp-admin/includes/plugin.php';
       echo is_plugin_active( 'hello/hello.php' ) ? 'active' : 'inactive';`,
    );

    expect(activated).toEqual({ ok: true, value: undefined });
    expect(active).toMatchObject({ ok: true, value: { output: 'active' } });
  });

  it('TC-PG-012b reports a plugin that does not exist', async () => {
    const service = serviceOverCli();
    await service.boot();

    const result = await service.activatePlugin('nope/nope.php');

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'php-error', message: expect.stringMatching(/\S/) as string },
    });
  });

  it('TC-PG-012c reports the WordPress and PHP versions', async () => {
    const service = serviceOverCli();
    await service.boot();

    const versions = await service.getVersions();

    expect(versions).toEqual({
      ok: true,
      value: {
        php: expect.stringMatching(/^8\.3\./) as string,
        wp: expect.stringMatching(/^\d+\.\d+/) as string,
      },
    });
  });

  for (const contractCase of PLAYGROUND_SERVICE_CONTRACT) {
    it(`TC-PG-009${contractCase.suffix} ${contractCase.name} (real PHP)`, async () => {
      await expect(contractCase.run(serviceOverCli())).resolves.toBeUndefined();
    });
  }
});
