import type * as Monaco from 'monaco-editor';
import { useEffect, type RefObject } from 'react';

import type { WorkspaceStore } from '@/stores';

import { FORMAT_ACTION_ID } from './editor-actions';

/** Runs palette requests (`requestEditorAction`) against the mounted editor and clears them. */
export function useEditorRequests(
  api: WorkspaceStore,
  editorRef: RefObject<Monaco.editor.IStandaloneCodeEditor | null>,
): void {
  useEffect(() => {
    return api.subscribe((state, previous) => {
      const request = state.editorRequest;
      if (request === null || request === previous.editorRequest) {
        return;
      }
      state.clearEditorRequest();
      const editor = editorRef.current;
      if (editor !== null) {
        void editor.getAction(FORMAT_ACTION_ID)?.run();
      }
    });
  }, [api, editorRef]);
}
