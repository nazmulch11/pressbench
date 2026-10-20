import type * as Monaco from 'monaco-editor';

import { canFormat, formatSource } from '@/lib/format';
import { createLogger } from '@/lib/logger';
import type { WorkspaceStore } from '@/stores';

const log = createLogger('editor');

export const FORMAT_ACTION_ID = 'pressbench.format';

type KeyApi = Pick<typeof Monaco, 'KeyMod' | 'KeyCode'>;

/**
 * Registers the editor's own actions: save (Ctrl/Cmd+S), show commands (Ctrl/Cmd+K and plain Ctrl+K, which
 * Monaco would otherwise swallow as a chord prefix or, on macOS, as "delete to end of line") and format
 * (Shift+Alt+F). `notify` shows a sentence under the editor.
 */
export function registerEditorActions(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: KeyApi,
  api: WorkspaceStore,
  notify: (notice: string) => void,
): void {
  editor.addAction({
    id: 'pressbench.save',
    label: 'Save file',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    run: () => {
      notify(saveActive(api));
    },
  });
  editor.addAction({
    id: 'pressbench.commands',
    label: 'Show commands',
    // Ctrl+K as well as Cmd+K: the shell accepts either modifier everywhere, but when the browser reports macOS
    // (Safari, and WebKit on Linux, which sends a Mac user agent) Monaco binds Ctrl+K to "delete to end of line"
    // and swallows it (TC-ED-025).
    keybindings: [
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      monaco.KeyMod.WinCtrl | monaco.KeyCode.KeyK,
    ],
    run: () => {
      api.getState().openPalette();
    },
  });
  editor.addAction({
    id: FORMAT_ACTION_ID,
    label: 'Format document',
    keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
    run: async (target) => {
      notify(await formatActive(api, target));
    },
  });
}

/** Saves the active file; returns the notice to show (empty on success). */
function saveActive(api: WorkspaceStore): string {
  const state = api.getState();
  if (state.activeTab === null) {
    return '';
  }
  const saved = state.saveFile(state.activeTab);
  if (saved.ok) {
    return '';
  }
  log.warn('save failed', { path: state.activeTab, message: saved.error.message });
  return `The file could not be saved: ${saved.error.message}`;
}

/** Formats the active file in place; returns the notice to show (empty when formatting succeeded). */
export async function formatActive(
  api: WorkspaceStore,
  editor: Monaco.editor.ICodeEditor,
): Promise<string> {
  const path = api.getState().activeTab;
  const model = editor.getModel();
  if (path === null || model === null) {
    return '';
  }
  if (!canFormat(path)) {
    return 'Formatting is not available for this file type yet (PHP formatting arrives in a later version). JavaScript, TypeScript, CSS, SCSS and JSON can be formatted.';
  }
  const result = await formatSource(path, model.getValue());
  if (editor.getModel() !== model) {
    // The user switched files while Prettier loaded; the result belongs to the old file.
    return '';
  }
  if (!result.ok) {
    return result.error.message;
  }
  if (result.value !== model.getValue()) {
    editor.executeEdits('format', [{ range: model.getFullModelRange(), text: result.value }]);
    editor.pushUndoStop();
  }
  return '';
}
