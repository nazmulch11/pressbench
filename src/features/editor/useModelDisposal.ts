import type * as Monaco from 'monaco-editor';
import { useEffect, type RefObject } from 'react';

import { isAncestor } from '@/lib/fs';
import type { WorkspaceStore } from '@/stores';

type ModelHost = Pick<typeof Monaco, 'editor' | 'Uri'>;

/** Disposes the models whose project path equals `path` or sits below it, except the one the editor shows. */
function disposeModelsUnder(monaco: ModelHost, path: string, keep: string | null): void {
  for (const model of monaco.editor.getModels()) {
    const modelPath = model.uri.path.replace(/^\//, '');
    if (modelPath === keep || (modelPath !== path && !isAncestor(path, modelPath))) {
      continue;
    }
    model.dispose();
  }
}

/**
 * Keeps Monaco's model list in step with the workspace: a closed tab, a renamed file or a deleted entry loses
 * its model, so memory is freed and a reopened file starts from the saved content.
 */
export function useModelDisposal(
  api: WorkspaceStore,
  monacoRef: RefObject<ModelHost | null>,
): void {
  useEffect(() => {
    const unsubscribeTabs = api.subscribe((state, previous) => {
      const monaco = monacoRef.current;
      if (monaco === null || state.tabs === previous.tabs) {
        return;
      }
      for (const closed of previous.tabs.filter((tab) => !state.tabs.includes(tab))) {
        disposeModelsUnder(monaco, closed, state.activeTab);
      }
    });
    const unsubscribeFs = api.getState().fs.onChange((change) => {
      const monaco = monacoRef.current;
      if (monaco === null) {
        return;
      }
      if (change.type === 'rename') {
        disposeModelsUnder(monaco, change.from, null);
      } else if (change.type === 'remove') {
        disposeModelsUnder(monaco, change.path, null);
      }
    });
    return () => {
      unsubscribeTabs();
      unsubscribeFs();
    };
  }, [api, monacoRef]);
}
