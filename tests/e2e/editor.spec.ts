import { expect, test } from './fixtures/pressbench';

const MAIN_FILE = 'my-plugin/my-plugin.php';

test.describe('editor', () => {
  test('TC-ED-001 opens a PHP file in Monaco with syntax highlighting', async ({
    page,
    workspace,
  }) => {
    await workspace.goto();

    await workspace.openInEditor('my-plugin.php');

    await expect(workspace.editorFrame).toHaveAttribute('data-language', 'php');
    await expect(workspace.editor).toHaveAccessibleName(`Editor: ${MAIN_FILE}`);
    await expect(workspace.monaco.locator('.view-line').first()).toContainText('<?php');
    const tokenClasses = await page
      .locator('.monaco-editor .view-line span[class*="mtk"]')
      .evaluateAll((spans) => new Set(spans.map((span) => span.getAttribute('class'))).size);
    expect(tokenClasses).toBeGreaterThanOrEqual(3);
  });

  test('TC-ED-008 lists WordPress functions in the suggest widget', async ({ page, workspace }) => {
    await workspace.goto();
    await workspace.openInEditor('my-plugin.php');
    await workspace.focusEditorEnd();

    await page.keyboard.press('Enter');
    await page.keyboard.type('wp_enqueue_sc');

    await expect(workspace.suggestWidget).toBeVisible();
    await expect(
      workspace.suggestWidget.getByText('wp_enqueue_script', { exact: true }),
    ).toBeVisible();
    await expect(
      workspace.suggestWidget.getByText('wp_enqueue_script_module', { exact: true }),
    ).toBeVisible();
  });

  test('TC-ED-011 lists action hooks inside add_action and inserts the chosen one', async ({
    page,
    workspace,
  }) => {
    await workspace.goto('/?debug=1');
    await workspace.openInEditor('my-plugin.php');
    await workspace.focusEditorEnd();

    await page.keyboard.press('Enter');
    await page.keyboard.type("add_action( 'ini");
    await expect(workspace.suggestWidget.getByText('init', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');

    await expect.poll(() => workspace.draft(MAIN_FILE)).toMatch(/add_action\( 'init\b/);
  });

  test('TC-ED-012 hovering a function shows its signature and reference link', async ({
    workspace,
  }) => {
    await workspace.goto();
    await workspace.openInEditor('my-plugin.php');

    await workspace.monaco.locator('.view-line').getByText('add_action').hover();

    await expect(workspace.hoverWidget).toBeVisible();
    await expect(workspace.hoverWidget).toContainText('add_action( $hook_name, $callback');
    await expect(workspace.hoverWidget).toContainText(
      'Adds a callback function to an action hook.',
    );
    await expect(
      workspace.hoverWidget.getByRole('link', { name: 'developer.wordpress.org' }),
    ).toHaveAttribute('href', /reference\/functions\/add_action/);
  });

  test('TC-ED-009 Ctrl/Cmd+S saves the draft once and clears the unsaved marker', async ({
    page,
    workspace,
  }) => {
    await workspace.goto('/?debug=1');
    await workspace.openInEditor('readme.txt');
    await page.evaluate(() => {
      let writes = 0;
      window.__PRESSBENCH__?.workspaceStore?.getState().fs.onChange((change) => {
        if (change.type === 'write') {
          writes += 1;
        }
      });
      (window as unknown as { __writes: () => number }).__writes = () => writes;
    });
    await workspace.focusEditorEnd();
    await page.keyboard.type(' edited');
    await expect(workspace.tab('readme.txt, unsaved')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+s');

    await expect(workspace.tab('readme.txt')).toBeVisible();
    await expect(workspace.tabs.getByText('●')).toBeHidden();
    expect(await workspace.savedContent('my-plugin/readme.txt')).toMatch(/ edited\n?$/);
    expect(
      await page.evaluate(() => (window as unknown as { __writes: () => number }).__writes()),
    ).toBe(1);
  });

  test('TC-ED-013 formats a CSS file from the palette and explains why PHP cannot be formatted', async ({
    page,
    workspace,
  }) => {
    await workspace.goto('/?debug=1');
    await workspace.openInEditor('style.css');
    await workspace.focusEditorEnd();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('.a{color:red}');
    await expect.poll(() => workspace.draft('my-plugin/assets/style.css')).toBe('.a{color:red}');

    await workspace.runCommand('format document');

    await expect
      .poll(() => workspace.draft('my-plugin/assets/style.css'))
      .toBe('.a {\n\tcolor: red;\n}\n');

    await workspace.openInEditor('my-plugin.php');
    await workspace.runCommand('format document');

    await expect(
      page.getByText('Formatting is not available for this file type yet', { exact: false }),
    ).toBeVisible();
  });

  test('TC-ED-010 loads Monaco only after a file is opened', async ({ page, workspace }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script' || request.resourceType() === 'fetch') {
        scripts.push(new URL(request.url()).pathname);
      }
    });
    await workspace.goto();
    await expect(page.getByRole('heading', { level: 1, name: 'Pressbench' })).toBeVisible();

    const beforeOpen = [...scripts];
    expect(beforeOpen.some((path) => path.includes('/assets/monaco-'))).toBe(false);
    expect(beforeOpen.some((path) => /wp-(functions|hooks)/.test(path))).toBe(false);

    await workspace.openInEditor('my-plugin.php');

    await expect
      .poll(() => scripts.some((path) => /\/assets\/monaco-[\w-]+\.js$/.test(path)))
      .toBe(true);
  });

  test('TC-ED-021 the open editor has no serious accessibility issues', async ({
    workspace,
    a11y,
  }) => {
    await workspace.goto();
    await workspace.openInEditor('my-plugin.php');
    await expect(workspace.editorFrame).toHaveAttribute('data-language', 'php');

    await a11y.check();
  });
});
