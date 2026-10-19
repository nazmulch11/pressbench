import { AxeBuilder } from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';

/**
 * Console errors that are expected and harmless. Every entry needs a comment saying why it is allowed.
 * Keep this list empty unless there is no way to fix the source of the message.
 */
const ALLOWED_CONSOLE_ERRORS: readonly RegExp[] = [];

export interface A11y {
  /** Runs axe on the current page and fails on serious or critical violations. */
  check(): Promise<void>;
}

interface PressbenchFixtures {
  /** Console and page errors seen during the test. The test fails at teardown if any are left. */
  pageErrors: string[];
  a11y: A11y;
}

export const test = base.extend<PressbenchFixtures>({
  pageErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() !== 'error') {
          return;
        }
        const text = message.text();
        if (!ALLOWED_CONSOLE_ERRORS.some((pattern) => pattern.test(text))) {
          errors.push(`console.error: ${text}`);
        }
      });
      page.on('pageerror', (error) => {
        errors.push(`pageerror: ${error.message}`);
      });

      await use(errors);

      if (testInfo.status !== testInfo.expectedStatus) {
        const logs = await page
          .evaluate(() => window.__PRESSBENCH_LOGS__ ?? null)
          .catch(() => null);
        if (logs !== null) {
          await testInfo.attach('pressbench-logs.json', {
            body: JSON.stringify(logs, null, 2),
            contentType: 'application/json',
          });
        }
      }
      expect(errors, 'console or page errors during the test').toEqual([]);
    },
    { auto: true },
  ],

  a11y: async ({ page }, use) => {
    await use({
      async check() {
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations
          .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
          .map(
            (violation) =>
              `${violation.id}: ${violation.help} (${String(violation.nodes.length)} nodes)`,
          );
        expect(serious, 'serious or critical accessibility violations').toEqual([]);
      },
    });
  },
});

export { expect };
