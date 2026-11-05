import { AxeBuilder } from '@axe-core/playwright';
import { expect, test as base } from '@playwright/test';

import { LOCAL_REMOTE_URL, PUBLIC_PLAYGROUND_HOSTS } from '../../../scripts/playground-remote/plan';
import { WorkspacePage } from '../pages/workspace';

const LOCAL_REMOTE_ORIGIN = new URL(LOCAL_REMOTE_URL).origin;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Console errors that are expected and harmless. Every entry needs a comment saying why it is allowed.
 * Keep this list empty unless there is no way to fix the source of the message.
 */
const ALLOWED_CONSOLE_ERRORS: readonly RegExp[] = [
  // Firefox only: WordPress Playground's own service worker (sw.js of the remote) logs this for a request with an
  // empty URL made from inside the WordPress iframe. It comes from the remote, not from Pressbench, and WordPress
  // works normally. Tracked as a known browser gap in ADR 0001.
  new RegExp(
    `A ServiceWorker intercepted the request and encountered an unexpected error.*${escapeRegExp(LOCAL_REMOTE_ORIGIN)}/sw\\.js`,
    's',
  ),
];

export interface A11y {
  /** Runs axe on the current page and fails on serious or critical violations. */
  check(): Promise<void>;
}

/** Requests the browser context made to a Playground remote, local or public. */
export interface PlaygroundRequests {
  /** URLs on the local remote (`LOCAL_REMOTE_URL`). */
  readonly local: string[];
  /** URLs on a public Playground host. The test fails at teardown if there are any (TC-PG-017). */
  readonly public: string[];
}

interface PressbenchFixtures {
  /** Console and page errors seen during the test. The test fails at teardown if any are left. */
  pageErrors: string[];
  playgroundRequests: PlaygroundRequests;
  a11y: A11y;
  /** Page object for the workspace shell (tree, tabs, editor, palette). */
  workspace: WorkspacePage;
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

  playgroundRequests: [
    async ({ context }, use) => {
      const requests: PlaygroundRequests = { local: [], public: [] };
      context.on('request', (request) => {
        const url = new URL(request.url());
        if (url.origin === LOCAL_REMOTE_ORIGIN) {
          requests.local.push(url.href);
        } else if (PUBLIC_PLAYGROUND_HOSTS.includes(url.hostname)) {
          requests.public.push(url.href);
        }
      });

      await use(requests);

      // The public hosts rate-limit CI (429 on wpsandbox.wordpress.net/sw.js, CI run 41959770262).
      expect(requests.public, 'requests to the public Playground hosts').toEqual([]);
    },
    { auto: true },
  ],

  workspace: async ({ page }, use) => {
    await use(new WorkspacePage(page));
  },

  a11y: async ({ page }, use) => {
    await use({
      async check() {
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations
          .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
          .map(
            (violation) =>
              `${violation.id}: ${violation.help} (${String(violation.nodes.length)} nodes): ${violation.nodes
                .map((node) => `${node.target.join(' ')} — ${node.failureSummary ?? ''}`)
                .join('; ')}`,
          );
        expect(serious, 'serious or critical accessibility violations').toEqual([]);
      },
    });
  },
});

export { expect };
