import { expect, test } from './fixtures/pressbench';

/**
 * Monaco picks platform defaults from `navigator.userAgent` (for example `renderFinalNewline` is `dimmed` on
 * Linux). CI runs on Linux; these tests give every engine a Linux user agent so the Linux behaviour is checked on
 * any machine. Only editor tests belong here: the Playground
 * remote does not boot under a user-agent override (docs/TESTING.md section 5).
 */
const LINUX_USER_AGENT: Record<string, (version: string) => string> = {
  chromium: (version) =>
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`,
  firefox: (version) =>
    `Mozilla/5.0 (X11; Linux x86_64; rv:${version}) Gecko/20100101 Firefox/${version}`,
  webkit: (version) =>
    `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`,
};

test.use({
  userAgent: async ({ browser, browserName }, use) => {
    const linux = LINUX_USER_AGENT[browserName];
    await use(linux === undefined ? undefined : linux(browser.version()));
  },
});

test.describe('editor with Linux platform defaults', () => {
  test('TC-ED-024 the open editor has no serious accessibility issues on Linux', async ({
    page,
    workspace,
    a11y,
  }) => {
    await workspace.goto();
    expect(await page.evaluate(() => navigator.userAgent)).toContain('Linux');

    await workspace.openInEditor('my-plugin.php');
    await expect(workspace.editorFrame).toHaveAttribute('data-language', 'php');

    await a11y.check();
  });
});
