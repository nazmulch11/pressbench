import { dirname } from '@/lib/fs';
import type { WorkspaceState } from '@/stores';

/** A palette command. `run` receives the current store state (with its actions). */
export interface Command {
  readonly id: string;
  readonly title: string;
  /** Extra words the filter should match, for example "sidebar" for "Toggle file tree". */
  readonly keywords?: readonly string[];
  /** Human-readable shortcut shown in the palette. */
  readonly shortcut?: string;
  run: (state: WorkspaceState) => void;
}

/** The folder a new entry from the palette goes into: the selected folder, the selected file's folder, or the root. */
export function targetFolder(state: WorkspaceState): string {
  const selection = state.treeSelection;
  if (selection === null) {
    return '';
  }
  const kind = state.fs.stat(selection);
  if (kind === 'directory') {
    return selection;
  }
  return kind === 'file' ? dirname(selection) : '';
}

/** The first commands of the workspace shell. Later phases append theirs. */
export const WORKSPACE_COMMANDS: readonly Command[] = [
  {
    id: 'file.new',
    title: 'New file',
    keywords: ['create'],
    run: (state: WorkspaceState): void => {
      state.requestTreeAction({ kind: 'new-file', parent: targetFolder(state) });
    },
  },
  {
    id: 'folder.new',
    title: 'New folder',
    keywords: ['create', 'directory'],
    run: (state: WorkspaceState): void => {
      state.requestTreeAction({ kind: 'new-folder', parent: targetFolder(state) });
    },
  },
  {
    id: 'file.save',
    title: 'Save file',
    shortcut: 'Ctrl/Cmd+S',
    run: (state: WorkspaceState): void => {
      if (state.activeTab !== null) {
        state.saveFile(state.activeTab);
      }
    },
  },
  {
    id: 'file.rename',
    title: 'Rename file',
    run: (state: WorkspaceState): void => {
      if (state.activeTab !== null) {
        state.requestTreeAction({ kind: 'rename', path: state.activeTab });
      }
    },
  },
  {
    id: 'editor.format',
    title: 'Format document',
    keywords: ['prettier', 'beautify', 'indent'],
    shortcut: 'Shift+Alt+F',
    run: (state: WorkspaceState): void => {
      if (state.activeTab !== null) {
        state.requestEditorAction({ kind: 'format' });
      }
    },
  },
  {
    id: 'tab.close',
    title: 'Close tab',
    shortcut: 'Ctrl/Cmd+W',
    run: (state: WorkspaceState): void => {
      if (state.activeTab !== null) {
        state.closeTab(state.activeTab);
      }
    },
  },
  {
    id: 'view.toggleSidebar',
    title: 'Toggle sidebar',
    keywords: ['file tree', 'files', 'explorer'],
    run: (state: WorkspaceState): void => {
      state.togglePanel('sidebar');
    },
  },
  {
    id: 'view.togglePreview',
    title: 'Toggle preview',
    keywords: ['wordpress', 'playground'],
    run: (state: WorkspaceState): void => {
      state.togglePanel('preview');
    },
  },
  {
    id: 'view.toggleBottomPanel',
    title: 'Toggle bottom panel',
    keywords: ['problems', 'logs', 'terminal'],
    run: (state: WorkspaceState): void => {
      state.togglePanel('bottom');
    },
  },
  {
    id: 'view.resetLayout',
    title: 'Reset layout',
    keywords: ['panels', 'sizes'],
    run: (state: WorkspaceState): void => {
      state.resetLayout();
    },
  },
];

/** Commands whose title or keywords contain every word of `query` (case-insensitive). */
export function filterCommands(commands: readonly Command[], query: string): readonly Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return commands;
  }
  return commands.filter((command) => {
    const haystack = [command.title, ...(command.keywords ?? [])].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
