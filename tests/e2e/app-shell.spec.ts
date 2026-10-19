import { expect, test } from './fixtures/pressbench';

test.describe('app shell', () => {
  test('TC-FND-001 renders the app shell', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Pressbench');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Pressbench' })).toBeVisible();
  });

  test('TC-FND-002 loads without console or page errors', async ({ page, pageErrors }) => {
    await page.goto('/');
    await page.waitForLoadState('load');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('TC-FND-004c exposes the log buffer in the browser with ?debug=1', async ({ page }) => {
    await page.goto('/?debug=1');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const logs = await page.evaluate(() => window.__PRESSBENCH_LOGS__);

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ namespace: 'ui', message: 'app mounted' }),
      ]),
    );
  });

  test('TC-FND-004d keeps the log buffer hidden without ?debug', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const hasLogs = await page.evaluate(() => '__PRESSBENCH_LOGS__' in window);

    expect(hasLogs).toBe(false);
  });

  test('TC-FND-005 serves the production build', async ({ page }) => {
    const requested: string[] = [];
    const scriptStatuses: number[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    page.on('response', (response) => {
      if (/\/assets\/index-[\w-]+\.js$/.test(new URL(response.url()).pathname)) {
        scriptStatuses.push(response.status());
      }
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expect(scriptStatuses.length).toBeGreaterThan(0);
    expect(scriptStatuses.every((status) => status === 200)).toBe(true);
    expect(requested).not.toContain('/@vite/client');
  });

  test('TC-FND-009 has no serious accessibility issues', async ({ page, a11y }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await a11y.check();
  });
});

test.describe('app shell in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('TC-FND-009a has no serious accessibility issues in dark mode', async ({ page, a11y }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await a11y.check();
  });
});
