import { strToU8, zipSync } from 'fflate';

import { expect, test } from './fixtures/pressbench';

const PLUGIN_MAIN = `<?php
/**
 * Plugin Name: Hello Pressbench
 */

defined( 'ABSPATH' ) || exit;
`;

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0xff, 0xfe,
]);

function zipBuffer(entries: Record<string, string | Uint8Array>): Buffer {
  const flat: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(entries)) {
    flat[path] = typeof content === 'string' ? strToU8(content) : content;
  }
  return Buffer.from(zipSync(flat));
}

test.describe('uploading a plugin or theme', () => {
  test('TC-PRJ-005 imports a plugin zip into the file tree and opens its main file', async ({
    page,
    workspace,
  }) => {
    await workspace.goto();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload plugin or theme' }).click();

    await (
      await chooser
    ).setFiles({
      name: 'hello-pressbench.zip',
      mimeType: 'application/zip',
      buffer: zipBuffer({
        'hello-pressbench/hello-pressbench.php': PLUGIN_MAIN,
        'hello-pressbench/assets/style.css': '.hello { color: red; }',
        'hello-pressbench/assets/icon.png': PNG,
      }),
    });

    await expect(
      page.getByText(
        'Imported plugin "hello-pressbench" (2 files). Skipped 1 binary file: hello-pressbench/assets/icon.png.',
      ),
    ).toBeVisible();
    await expect(workspace.treeItem('hello-pressbench')).toBeVisible();
    await expect(workspace.treeItem('hello-pressbench.php')).toBeVisible();
    await expect(page.locator('[data-path="hello-pressbench/assets"]')).toBeVisible();
    await expect(workspace.tab('hello-pressbench.php')).toHaveAttribute('aria-current', 'true');
  });

  test('TC-PRJ-006 imports a theme zip', async ({ page, workspace }) => {
    await workspace.goto();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload plugin or theme' }).click();

    await (
      await chooser
    ).setFiles({
      name: 'pressbench-blocks.zip',
      mimeType: 'application/zip',
      buffer: zipBuffer({
        'pressbench-blocks/style.css': '/*\nTheme Name: Pressbench Blocks\n*/\n',
        'pressbench-blocks/templates/index.html':
          '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->',
      }),
    });

    await expect(page.getByText('Imported theme "pressbench-blocks" (2 files).')).toBeVisible();
    await expect(workspace.treeItem('pressbench-blocks')).toBeVisible();
    await expect(workspace.tab('style.css')).toHaveAttribute('aria-current', 'true');
  });
});
