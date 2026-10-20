import { Editor } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useMemo, useRef, useState } from 'react';

import { useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';

import styles from './CodeEditor.module.css';
import { registerEditorActions } from './editor-actions';
import { languageForPath } from './languages';
import './monaco-environment';
import { useColorScheme } from './useColorScheme';
import { useEditorRequests } from './useEditorRequests';
import { useModelDisposal } from './useModelDisposal';
import { ensureWordPressProviders } from './wordpress-providers';

type MonacoApi = typeof Monaco;
type CodeEditorInstance = Monaco.editor.IStandaloneCodeEditor;

const DATA_NOTICE =
  'WordPress function and hook data could not be loaded, so completion and hover docs are off. Reload the page to try again.';

/** `file:///my-plugin/my-plugin.php`: one Monaco model per open project file. */
function modelUri(path: string): string {
  return `file:///${path}`;
}

/**
 * The Monaco editor over the active tab. Loaded lazily through `CodeEditor`; reads drafts from the workspace
 * store and writes every change back as a draft, so saving, the unsaved marker and the close dialog work
 * exactly as with the Phase 2 text area.
 */
export function MonacoEditor(): React.JSX.Element | null {
  const api = useWorkspaceStoreApi();
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const value = useWorkspaceStore((state) => {
    if (state.activeTab === null) {
      return '';
    }
    const draft = state.drafts[state.activeTab];
    if (draft !== undefined) {
      return draft;
    }
    const saved = state.fs.read(state.activeTab);
    return saved.ok ? saved.value : '';
  });
  const scheme = useColorScheme();
  const [notice, setNotice] = useState('');
  const [providersReady, setProvidersReady] = useState(false);
  const editorRef = useRef<CodeEditorInstance | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  useModelDisposal(api, monacoRef);
  useEditorRequests(api, editorRef);

  const options = useMemo<Monaco.editor.IStandaloneEditorConstructionOptions>(
    () => ({
      ariaLabel: `Editor: ${activeTab ?? ''}`,
      automaticLayout: true,
      fontSize: 13,
      minimap: { enabled: false },
      quickSuggestions: { other: true, comments: false, strings: true },
      // Monaco defaults to 'dimmed' on Linux only; the stock themes draw that number at 1.75:1 contrast,
      // which fails WCAG AA (TC-ED-024). Same rendering on every platform.
      renderFinalNewline: 'on',
      scrollBeyondLastLine: false,
      tabSize: 4,
      insertSpaces: false,
    }),
    [activeTab],
  );

  if (activeTab === null) {
    return null;
  }

  const onMount = (editor: CodeEditorInstance, monaco: MonacoApi): void => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerEditorActions(editor, monaco, api, setNotice);
    void ensureWordPressProviders(monaco).then((ready) => {
      setProvidersReady(ready);
      if (!ready) {
        setNotice(DATA_NOTICE);
      }
    });
  };

  const language = languageForPath(activeTab);
  return (
    <div
      className={styles.frame}
      data-language={language}
      data-wp-data={providersReady ? 'ready' : 'loading'}
    >
      <Editor
        // The wrapper section defaults to `height: 100%`; as a flex child it must share the frame with the notice line.
        wrapperProps={{ className: styles.editor }}
        path={modelUri(activeTab)}
        language={language}
        value={value}
        theme={scheme === 'dark' ? 'vs-dark' : 'vs'}
        options={options}
        loading={<p className={styles.loading}>Loading editor…</p>}
        onMount={onMount}
        onChange={(next) => {
          setNotice('');
          api.getState().setDraft(activeTab, next ?? '');
        }}
      />
      <p className={styles.notice} aria-live="polite">
        {notice}
      </p>
    </div>
  );
}
