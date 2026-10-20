import { expect, type Locator, type Page } from '@playwright/test';

/** Page object for the workspace shell and the editor. Locators are role-based; nothing here waits on time. */
export class WorkspacePage {
  readonly tree: Locator;
  readonly tabs: Locator;
  /**
   * The editor's accessible text box (`Editor: <path>`). Monaco's is zero-width, so assert `toBeAttached()`
   * or `toHaveAccessibleName()` on it and use `monaco` for visibility.
   */
  readonly editor: Locator;
  /** The Monaco editor surface. */
  readonly monaco: Locator;
  /** The frame around Monaco; carries `data-language`. */
  readonly editorFrame: Locator;
  readonly suggestWidget: Locator;
  readonly hoverWidget: Locator;
  readonly paletteInput: Locator;

  constructor(readonly page: Page) {
    this.tree = page.getByRole('tree', { name: 'Files' });
    this.tabs = page.getByRole('list', { name: 'Open files' });
    this.editor = page.getByRole('textbox', { name: /^Editor: / });
    this.monaco = page.locator('.monaco-editor').first();
    this.editorFrame = page.locator('[data-language]');
    this.suggestWidget = page.locator('.suggest-widget');
    this.hoverWidget = page.locator('.monaco-hover:not(.hidden)');
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

  /** Opens a file and waits for Monaco to show it and for the WordPress data to be registered. */
  async openInEditor(name: string): Promise<void> {
    await this.openFile(name);
    await expect(this.monaco.locator('.view-lines')).toBeVisible();
    await expect(this.editorFrame).toHaveAttribute('data-wp-data', 'ready');
  }

  /**
   * Puts the cursor at the end of the document by clicking past the end of the last line, then waits until
   * Monaco shows the cursor there. (A Ctrl/Cmd+End keypress right after focusing is dropped under load.)
   */
  async focusEditorEnd(): Promise<void> {
    await this.monaco.locator('.view-lines').click();
    await expect(this.editor).toBeFocused();
    const lastLine = await this.monaco.locator('.view-lines').evaluate((lines) => {
      const rows = [...lines.querySelectorAll<HTMLElement>('.view-line')];
      const last = rows.reduce((best, row) =>
        Number.parseFloat(row.style.top) > Number.parseFloat(best.style.top) ? row : best,
      );
      const rect = last.getBoundingClientRect();
      // Lines are as wide as the longest line, which may run past the visible editor: stay inside it.
      const visible = (lines.closest('.overflow-guard') ?? lines).getBoundingClientRect();
      return {
        x: Math.min(rect.right, visible.right) - 24,
        y: rect.top + rect.height / 2,
        top: last.style.top,
      };
    });
    await this.page.mouse.click(lastLine.x, lastLine.y);
    await expect
      .poll(() =>
        this.page.evaluate(
          (top) =>
            document.querySelector<HTMLElement>('.monaco-editor .current-line')?.parentElement
              ?.style.top === top,
          lastLine.top,
        ),
      )
      .toBe(true);
  }

  /** The unsaved draft of a file from the store; needs `?debug=1`. */
  async draft(path: string): Promise<string | undefined> {
    return this.page.evaluate(
      (target) => window.__PRESSBENCH__?.workspaceStore?.getState().drafts[target],
      path,
    );
  }

  /** Replaces a file's saved content through the store (a seed for a test); needs `?debug=1`. */
  async writeFile(path: string, content: string): Promise<void> {
    await this.page.evaluate(
      ([target, text]) => {
        window.__PRESSBENCH__?.workspaceStore?.getState().fs.write(target ?? '', text ?? '');
      },
      [path, content],
    );
  }

  /** The saved content of a file from the store; needs `?debug=1`. */
  async savedContent(path: string): Promise<string | undefined> {
    return this.page.evaluate((target) => {
      const read = window.__PRESSBENCH__?.workspaceStore?.getState().fs.read(target);
      return read?.ok === true ? read.value : undefined;
    }, path);
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
