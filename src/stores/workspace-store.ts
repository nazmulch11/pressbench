import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  basename,
  createProjectFs,
  dirname,
  isAncestor,
  joinPath,
  type FsChange,
  type FsEntry,
  type FsError,
  type ProjectFs,
  type ProjectFsSeed,
  validateName,
} from '@/lib/fs';
import { err, ok, type Result } from '@/lib/result';
import { createPreferences, type Preferences } from '@/lib/storage';

import { DEMO_PROJECT } from './demo-project';
import {
  clampPanelSize,
  DEFAULT_LAYOUT,
  LAYOUT_PREFERENCE_KEY,
  readLayout,
  writeLayout,
  type LayoutState,
  type PanelName,
} from './layout';
import { dropDrafts, moveItem, nextActiveTab, remapDrafts, remapPath, withoutDraft } from './tabs';

/** Something the command palette asks the editor to do. */
export interface EditorRequest {
  readonly kind: 'format';
}

/** Something the command palette or a shortcut asks the file tree to start. */
export type TreeRequest =
  | { readonly kind: 'new-file' | 'new-folder'; readonly parent: string }
  | { readonly kind: 'rename'; readonly path: string };

export interface WorkspaceState {
  readonly fs: ProjectFs;
  /** Every entry of the project, refreshed after each change. */
  readonly entries: readonly FsEntry[];
  /** Open file paths in tab order. */
  readonly tabs: readonly string[];
  readonly activeTab: string | null;
  /** Unsaved content per open file. A path is "dirty" when it has a draft. */
  readonly drafts: Readonly<Record<string, string>>;
  /** The edited tab waiting for the user's Save / Don't save / Cancel answer. */
  readonly closing: string | null;
  readonly layout: LayoutState;
  readonly isPaletteOpen: boolean;
  /** Pending request plus a serial, so the tree reacts to the same request made twice. */
  readonly treeRequest: (TreeRequest & { readonly serial: number }) | null;
  /** The tree's selected entry; new files from the palette go next to it. */
  readonly treeSelection: string | null;
  /** Pending request for the editor plus a serial, so the editor reacts to the same request made twice. */
  readonly editorRequest: (EditorRequest & { readonly serial: number }) | null;

  createFile: (parent: string, name: string) => Result<string, FsError>;
  createFolder: (parent: string, name: string) => Result<string, FsError>;
  renameEntry: (path: string, name: string) => Result<string, FsError>;
  moveEntry: (path: string, targetDirectory: string) => Result<string, FsError>;
  removeEntry: (path: string) => Result<void, FsError>;
  saveFile: (path: string) => Result<void, FsError>;

  openFile: (path: string) => void;
  activateTab: (path: string) => void;
  /** Closes at once, or asks first when the tab has a draft. */
  closeTab: (path: string) => 'closed' | 'needs-confirm';
  cancelClose: () => void;
  discardAndClose: (path: string) => void;
  saveAndClose: (path: string) => Result<void, FsError>;
  moveTab: (path: string, toIndex: number) => void;
  setDraft: (path: string, content: string) => void;

  /** `persist: false` while a splitter is being dragged; the drop commits once. */
  setPanelSize: (panel: PanelName, size: number, persist?: boolean) => void;
  togglePanel: (panel: PanelName) => void;
  resetLayout: () => void;

  openPalette: () => void;
  closePalette: () => void;
  requestTreeAction: (request: TreeRequest) => void;
  clearTreeRequest: () => void;
  setTreeSelection: (path: string | null) => void;
  requestEditorAction: (request: EditorRequest) => void;
  clearEditorRequest: () => void;
}

export type WorkspaceStore = StoreApi<WorkspaceState>;

export interface WorkspaceStoreOptions {
  /** Initial project files. Defaults to the demo plugin. */
  readonly seed?: ProjectFsSeed;
  /** Where layout preferences live. Defaults to memory only. */
  readonly preferences?: Preferences;
}

/** Creates the workspace store: project files, tabs, drafts, layout and small UI flags. */
export function createWorkspaceStore(options: WorkspaceStoreOptions = {}): WorkspaceStore {
  const preferences = options.preferences ?? createPreferences(null);
  const fs = createProjectFs(options.seed ?? DEMO_PROJECT);
  let requestSerial = 0;

  /** A rejected name becomes an `invalid-path` error with the reason as its message. */
  const checkName = (parent: string, name: string): Result<string, FsError> => {
    const checked = validateName(name);
    return checked.ok
      ? ok(joinPath(parent, name))
      : err({ kind: 'invalid-path', path: joinPath(parent, name), message: checked.error });
  };

  const store = createStore<WorkspaceState>()((set, get) => {
    const removeTabs = (removed: string): void => {
      const { tabs, activeTab, drafts } = get();
      const survivors = tabs.filter((tab) => tab !== removed && !isAncestor(removed, tab));
      let nextActive = activeTab;
      if (activeTab !== null && !survivors.includes(activeTab)) {
        const closedIndex = tabs.indexOf(activeTab);
        nextActive =
          survivors.find((tab) => tabs.indexOf(tab) > closedIndex) ?? survivors.at(-1) ?? null;
      }
      set({ tabs: survivors, activeTab: nextActive, drafts: dropDrafts(drafts, removed) });
    };

    const applyChange = (change: FsChange): void => {
      if (change.type === 'rename') {
        const { tabs, activeTab, drafts } = get();
        set({
          tabs: tabs.map((tab) => remapPath(tab, change.from, change.to) ?? tab),
          activeTab:
            activeTab === null ? null : (remapPath(activeTab, change.from, change.to) ?? activeTab),
          drafts: remapDrafts(drafts, change.from, change.to),
        });
      } else if (change.type === 'remove') {
        removeTabs(change.path);
      }
      set({ entries: fs.entries() });
    };
    fs.onChange(applyChange);

    const closeNow = (path: string): void => {
      const { tabs, activeTab, drafts } = get();
      set({
        tabs: tabs.filter((tab) => tab !== path),
        activeTab: nextActiveTab(tabs, activeTab, path),
        drafts: withoutDraft(drafts, path),
        closing: null,
      });
    };

    const updateLayout = (layout: LayoutState, persist = true): void => {
      if (persist) {
        writeLayout(preferences, layout);
      }
      set({ layout });
    };

    return {
      fs,
      entries: fs.entries(),
      tabs: [],
      activeTab: null,
      drafts: {},
      closing: null,
      layout: readLayout(preferences),
      isPaletteOpen: false,
      treeRequest: null,
      treeSelection: null,
      editorRequest: null,

      createFile(parent, name) {
        const checked = checkName(parent, name);
        if (!checked.ok) {
          return checked;
        }
        const path = checked.value;
        if (fs.exists(path)) {
          return err({ kind: 'exists', path, message: `"${name}" already exists here.` });
        }
        const written = fs.write(path, '');
        if (!written.ok) {
          return written;
        }
        get().openFile(path);
        return ok(path);
      },
      createFolder(parent, name) {
        const checked = checkName(parent, name);
        if (!checked.ok) {
          return checked;
        }
        const made = fs.mkdir(checked.value);
        return made.ok ? checked : made;
      },
      renameEntry(path, name) {
        if (name === basename(path)) {
          return ok(path);
        }
        const checked = checkName(dirname(path), name);
        if (!checked.ok) {
          return checked;
        }
        const renamed = fs.rename(path, checked.value);
        return renamed.ok ? checked : renamed;
      },
      moveEntry(path, targetDirectory) {
        const target = joinPath(targetDirectory, basename(path));
        if (target === path) {
          return ok(path);
        }
        const moved = fs.rename(path, target);
        return moved.ok ? ok(target) : moved;
      },
      removeEntry: (path) => fs.remove(path),
      saveFile(path) {
        const draft = get().drafts[path];
        if (draft === undefined) {
          return ok(undefined);
        }
        const written = fs.write(path, draft);
        if (written.ok) {
          set({ drafts: withoutDraft(get().drafts, path) });
        }
        return written;
      },

      openFile(path) {
        const { tabs } = get();
        set({ tabs: tabs.includes(path) ? tabs : [...tabs, path], activeTab: path });
      },
      activateTab(path) {
        if (get().tabs.includes(path)) {
          set({ activeTab: path });
        }
      },
      closeTab(path) {
        if (get().drafts[path] !== undefined) {
          set({ closing: path });
          return 'needs-confirm';
        }
        closeNow(path);
        return 'closed';
      },
      cancelClose: () => {
        set({ closing: null });
      },
      discardAndClose: closeNow,
      saveAndClose(path) {
        const saved = get().saveFile(path);
        if (saved.ok) {
          closeNow(path);
        }
        return saved;
      },
      moveTab(path, toIndex) {
        set({ tabs: moveItem(get().tabs, path, toIndex) });
      },
      setDraft(path, content) {
        const saved = fs.read(path);
        const rest = withoutDraft(get().drafts, path);
        const isClean = saved.ok && saved.value === content;
        set({ drafts: isClean ? rest : { ...rest, [path]: content } });
      },

      setPanelSize(panel, size, persist = true) {
        const { layout } = get();
        updateLayout(
          { ...layout, sizes: { ...layout.sizes, [panel]: clampPanelSize(panel, size) } },
          persist,
        );
      },
      togglePanel(panel) {
        const { layout } = get();
        updateLayout({
          ...layout,
          visible: { ...layout.visible, [panel]: !layout.visible[panel] },
        });
      },
      resetLayout() {
        preferences.remove(LAYOUT_PREFERENCE_KEY);
        set({ layout: DEFAULT_LAYOUT });
      },

      openPalette: () => {
        set({ isPaletteOpen: true });
      },
      closePalette: () => {
        set({ isPaletteOpen: false });
      },
      requestTreeAction(request) {
        requestSerial += 1;
        set({ treeRequest: { ...request, serial: requestSerial } });
      },
      clearTreeRequest: () => {
        set({ treeRequest: null });
      },
      setTreeSelection: (path) => {
        set({ treeSelection: path });
      },
      requestEditorAction(request) {
        requestSerial += 1;
        set({ editorRequest: { ...request, serial: requestSerial } });
      },
      clearEditorRequest: () => {
        set({ editorRequest: null });
      },
    };
  });

  return store;
}
