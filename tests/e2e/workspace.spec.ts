import { expect, test } from './fixtures/pressbench';

test.describe('workspace shell', () => {
  test.beforeEach(async ({ workspace }) => {
    await workspace.goto();
  });

  test('TC-WS-001 shows the files, editor, preview and bottom panel regions', async ({
    workspace,
  }) => {
    await expect(workspace.region('Files')).toBeVisible();
    await expect(workspace.region('Editor')).toBeVisible();
    await expect(workspace.region('Preview')).toBeVisible();
    await expect(workspace.region('Bottom panel')).toBeVisible();
    await expect(workspace.tree).toBeVisible();
    await expect(workspace.treeItem('my-plugin.php')).toBeVisible();
  });

  test('TC-WS-002 dragging the sidebar splitter resizes it and the size survives a reload', async ({
    page,
    workspace,
  }) => {
    const sidebar = workspace.region('Files');
    const splitter = page.getByRole('separator', { name: 'Resize sidebar' });
    const before = (await sidebar.boundingBox())!;
    const handle = (await splitter.boundingBox())!;

    const y = handle.y + handle.height / 2;
    await page.mouse.move(handle.x + handle.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 120, y, { steps: 8 });
    await page.mouse.up();

    const expected = before.width + 120;
    await expect(splitter).toHaveAttribute('aria-valuenow', String(Math.round(expected)));
    const after = await sidebar.boundingBox();
    expect(Math.abs((after?.width ?? 0) - expected)).toBeLessThanOrEqual(4);

    await page.reload();
    await expect(workspace.tree).toBeVisible();

    await expect(splitter).toHaveAttribute('aria-valuenow', String(Math.round(expected)));
    const reloaded = await sidebar.boundingBox();
    expect(Math.abs((reloaded?.width ?? 0) - expected)).toBeLessThanOrEqual(4);
  });

  test('TC-WS-007 dragging a file onto a folder moves it and the open tab follows', async ({
    page,
    workspace,
  }) => {
    await workspace.createFile('my-plugin', 'a.php');
    await expect(workspace.tab('a.php')).toBeVisible();

    await workspace.dragTreeItem('a.php', 'includes');

    await expect(workspace.treeItem('a.php')).toHaveAttribute(
      'data-path',
      'my-plugin/includes/a.php',
    );
    await expect(workspace.tab('a.php')).toBeVisible();
    await expect(workspace.monaco).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Editor: my-plugin/includes/a.php' }),
    ).toBeAttached();
  });

  test('TC-WS-008 the tree works with the keyboard alone', async ({ page, workspace }) => {
    await page.getByRole('button', { name: /^Commands/ }).focus();
    await page.keyboard.press('Tab');
    await expect(workspace.treeItem('my-plugin')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(workspace.treeItem('assets')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(workspace.treeItem('assets')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(workspace.treeItem('assets')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(workspace.treeItem('class-my-plugin.php')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(workspace.tab('class-my-plugin.php')).toBeVisible();
    await expect(workspace.treeItem('class-my-plugin.php')).toBeFocused();

    await page.keyboard.press('F2');
    const rename = page.getByRole('textbox', { name: 'New name' });
    await expect(rename).toBeFocused();
    await expect(rename).toHaveValue('class-my-plugin.php');
    await page.keyboard.press('Escape');
    await expect(rename).toBeHidden();
    await expect(workspace.treeItem('class-my-plugin.php')).toBeFocused();

    await page.keyboard.press('Delete');
    const dialog = page.getByRole('alertdialog', { name: 'Delete class-my-plugin.php?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(workspace.treeItem('class-my-plugin.php')).toBeFocused();

    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu', { name: 'File actions' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Open' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(workspace.treeItem('class-my-plugin.php')).toBeFocused();
  });

  test('TC-WS-010 an edited tab shows the unsaved marker and closing it asks first', async ({
    page,
    workspace,
  }) => {
    await workspace.openInEditor('readme.txt');
    await workspace.focusEditorEnd();
    await page.keyboard.type(' edited');

    await expect(workspace.tab('readme.txt, unsaved')).toBeVisible();
    await expect(workspace.tabs.getByText('●')).toBeVisible();

    await workspace.tab('Close readme.txt').click();

    const dialog = page.getByRole('alertdialog', { name: 'Save changes to readme.txt?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: "Don't save" })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('TC-WS-011 Ctrl/Cmd+K, "new file", Enter opens the new-file prompt', async ({
    page,
    workspace,
  }) => {
    await workspace.openPalette();
    await workspace.paletteInput.fill('new file');
    await expect(page.getByRole('option', { name: 'New file' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await workspace.paletteInput.press('Enter');

    await expect(workspace.paletteInput).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'New file name' })).toBeFocused();
  });

  test('TC-WS-012 the workspace has no serious accessibility issues', async ({
    workspace,
    a11y,
  }) => {
    await workspace.openInEditor('readme.txt');
    await a11y.check();

    await workspace.openPalette();
    await expect(workspace.paletteInput).toBeFocused();
    await a11y.check();

    await workspace.paletteInput.fill('no such command');
    await expect(workspace.page.getByText('No matching commands')).toBeVisible();
    await a11y.check();
  });
});

test.describe('workspace shell in dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('TC-WS-012a the workspace has no serious accessibility issues in dark mode', async ({
    workspace,
    a11y,
  }) => {
    await workspace.goto();
    await workspace.openFile('readme.txt');
    await workspace.treeItem('readme.txt').click({ button: 'right' });
    await expect(workspace.page.getByRole('menu', { name: 'File actions' })).toBeVisible();

    await a11y.check();
  });
});
