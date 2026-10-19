import { expect, type Locator, type Page } from '@playwright/test';

/** Page object for the Phase 2 workspace shell. Locators are role-based; nothing here waits on time. */
export class WorkspacePage {
  readonly tree: Locator;
  readonly tabs: Locator;
  readonly editor: Locator;
  readonly paletteInput: Locator;

  constructor(readonly page: Page) {
    this.tree = page.getByRole('tree', { name: 'Files' });
    this.tabs = page.getByRole('list', { name: 'Open files' });
    this.editor = page.getByRole('textbox', { name: /^Editor: / });
    this.paletteInput = page.getByRole('combobox', { name: 'Search commands' });
  }

  region(name: 'Files' | 'Editor' | 'Preview' | 'Bottom panel'): Locator {
    return this.page.getByRole('region', { name, exact: true });
  }

  treeItem(name: string): Locator {
    return this.tree.getByRole('treeitem', { name, exact: true });
  }

  tab(name: string): Locator {
    return this.tabs.getByRole('button', { name, exact: true });
  }

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
    await expect(this.tree).toBeVisible();
  }

  async openFile(name: string): Promise<void> {
    await this.treeItem(name).click();
    await expect(this.tab(name)).toBeVisible();
  }

  /** Right-click a folder, choose "New file", type the name, press Enter. */
  async createFile(folder: string, name: string): Promise<void> {
    await this.treeItem(folder).click({ button: 'right' });
    await this.page.getByRole('menuitem', { name: 'New file' }).click();
    const input = this.page.getByRole('textbox', { name: 'New file name' });
    await input.fill(name);
    await input.press('Enter');
    await expect(this.treeItem(name)).toBeVisible();
  }

  /** Drags one tree item onto another with the mouse (pointer events, works in every engine). */
  async dragTreeItem(from: string, to: string): Promise<void> {
    const source = await this.treeItem(from).boundingBox();
    const target = await this.treeItem(to).boundingBox();
    if (source === null || target === null) {
      throw new Error(`cannot drag ${from} to ${to}: an item is not visible`);
    }
    const start = { x: source.x + 40, y: source.y + source.height / 2 };
    const end = { x: target.x + 40, y: target.y + target.height / 2 };
    await this.page.mouse.move(start.x, start.y);
    await this.page.mouse.down();
    await this.page.mouse.move(start.x + 10, start.y, { steps: 3 });
    await this.page.mouse.move(end.x, end.y, { steps: 10 });
    await expect(this.treeItem(to)).toHaveAttribute('data-drop-target', 'true');
    await this.page.mouse.up();
  }

  async openPalette(): Promise<void> {
    await this.page.keyboard.press('ControlOrMeta+k');
    await expect(this.paletteInput).toBeVisible();
  }

  async runCommand(query: string): Promise<void> {
    await this.openPalette();
    await this.paletteInput.fill(query);
    await this.paletteInput.press('Enter');
    await expect(this.paletteInput).toBeHidden();
  }
}
