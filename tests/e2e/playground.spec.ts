import type { Page } from '@playwright/test';

import { expect, test } from './fixtures/pressbench';
import type { PlaygroundService } from '../../src/lib/playground';

const HELLO_PLUGIN = `<?php
/**
 * Plugin Name: Pressbench Hello
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_notices', 'pressbench_hello_notice' );

function pressbench_hello_notice() {
	echo '<div class="notice notice-success"><p>Hello from Pressbench e2e</p></div>';
}
`;

const PERSISTENT_DIR = '/wordpress/wp-content/plugins/pressbench-spike';

/** Whether `PERSISTENT_DIR` survives a reload in each engine (TC-PG-006). */
const EXPECTED_PERSISTENCE: Record<string, 'on' | 'unavailable'> = {
  chromium: 'on',
  firefox: 'on',
  webkit: 'unavailable',
};

const STATUS_PATTERN = {
  on: /^Ready in \d+(\.\d+)? s$/,
  unavailable: /^Ready in \d+(\.\d+)? s\. Files will not be kept: .+$/,
};

/** What `persist()` and the read after reload give, per persistence mode. */
const EXPECTED_ROUND_TRIP = {
  on: (content: string) => ({
    persisted: { ok: true, value: undefined },
    read: { ok: true, value: content },
  }),
  unavailable: () => ({
    persisted: {
      ok: false,
      error: {
        kind: 'unknown',
        message: expect.stringContaining('Files are not kept') as unknown as string,
      },
    },
    read: { ok: false, error: { kind: 'io' } },
  }),
};

type ServiceMethod<K extends keyof PlaygroundService> = PlaygroundService[K] extends (
  ...args: infer A
) => Promise<infer R>
  ? { args: A; result: R }
  : never;

/** Calls one method of the service exposed by `?debug=1` inside the page. */
async function callService<K extends keyof PlaygroundService>(
  page: Page,
  method: K,
  ...args: ServiceMethod<K>['args']
): Promise<ServiceMethod<K>['result']> {
  const value: unknown = await page.evaluate(
    async ({ method, args }) => {
      const service = window.__PRESSBENCH__?.playgroundService;
      if (service === undefined) {
        throw new Error('window.__PRESSBENCH__.playgroundService is not set; open /?debug=1');
      }
      const methods = service as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
      const fn = methods[method];
      if (fn === undefined) {
        throw new Error(`playgroundService has no method ${method}`);
      }
      return fn.apply(service, args);
    },
    { method: method, args: args },
  );
  return value;
}

async function startWordPress(
  page: Page,
  options: { wp?: string; php?: string; persist?: boolean } = {},
): Promise<void> {
  if (options.wp !== undefined) {
    await page.getByRole('combobox', { name: 'WordPress version' }).selectOption(options.wp);
  }
  if (options.php !== undefined) {
    await page.getByRole('combobox', { name: 'PHP version' }).selectOption(options.php);
  }
  if (options.persist === true) {
    await page.getByRole('checkbox', { name: 'Keep files between reloads' }).check();
  }
  await page.getByRole('button', { name: 'Start WordPress' }).click();
  await expect(page.getByRole('status')).toHaveText(/^Ready in \d+(\.\d+)? s/, {
    timeout: 90_000,
  });
}

test.describe('playground spike', () => {
  // Cold boots download WordPress and PHP from the hosted remote.
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/?debug=1');
  });

  test('TC-PG-001 boots WordPress and lands on the homepage', async ({ page }) => {
    await startWordPress(page);

    const url = await callService(page, 'getCurrentUrl');
    const home = await callService(
      page,
      'run',
      "<?php require '/wordpress/wp-load.php'; echo get_bloginfo( 'name' );",
    );

    expect(url).toEqual({ ok: true, value: '/' });
    expect(home).toMatchObject({ ok: true, value: { exitCode: 0 } });
    expect(home.ok && home.value.output.length).toBeGreaterThan(0);
  });

  test('TC-PG-002 writes and activates a plugin whose notice shows in wp-admin', async ({
    page,
  }) => {
    await startWordPress(page);

    const written = await callService(
      page,
      'writeFile',
      '/wordpress/wp-content/plugins/hello/hello.php',
      HELLO_PLUGIN,
    );
    const activated = await callService(page, 'activatePlugin', 'hello/hello.php');
    const admin = await callService(page, 'request', '/wp-admin/');

    expect(written).toEqual({ ok: true, value: undefined });
    expect(activated).toEqual({ ok: true, value: undefined });
    expect(admin).toMatchObject({ ok: true });
    expect(admin.ok && admin.value.body).toContain('Hello from Pressbench e2e');
  });

  test('TC-PG-005 boots the requested WordPress and PHP versions', async ({ page }) => {
    await startWordPress(page, { wp: '6.8', php: '8.3' });

    const versions = await callService(page, 'getVersions');

    expect(versions).toMatchObject({ ok: true });
    expect(versions.ok && versions.value.wp).toMatch(/^6\.8/);
    expect(versions.ok && versions.value.php).toMatch(/^8\.3\./);
  });

  test('TC-PG-006 keeps a persisted file across a page reload', async ({ page, browserName }) => {
    const path = `${PERSISTENT_DIR}/persisted.txt`;
    const content = `written at ${String(Date.now())}`;
    const expected = EXPECTED_PERSISTENCE[browserName] ?? 'on';
    await startWordPress(page, { persist: true });
    const state = await page.evaluate(() => window.__PRESSBENCH__?.playgroundService?.state);

    // The known browser gap: WebKit gives the Playground iframe no origin-private file system. The matrix is
    // asserted so a change in either direction shows up here. See docs/adr/0001-browser-first-on-playground.md.
    expect(state).toMatchObject({ status: 'ready', persistence: expected });
    await expect(page.getByRole('status')).toHaveText(STATUS_PATTERN[expected]);

    const written = await callService(page, 'writeFile', path, content);
    const persisted = await callService(page, 'persist');
    await page.reload();
    await startWordPress(page, { persist: true });
    const read = await callService(page, 'readFile', path);

    expect(written).toEqual({ ok: true, value: undefined });
    expect({ persisted, read }).toMatchObject(EXPECTED_ROUND_TRIP[expected](content));
  });
});
