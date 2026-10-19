import type { ReactNode } from 'react';

import { useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';

import styles from './Workspace.module.css';

export interface EditorAreaProps {
  /** The editor over the active file. When absent, a plain text area is used (component tests, no Monaco). */
  editor?: ReactNode;
}

/** The editor column below the tabs: an empty state, or the path line and the editor of the active file. */
export function EditorArea({ editor }: EditorAreaProps): React.JSX.Element {
  const activeTab = useWorkspaceStore((state) => state.activeTab);

  if (activeTab === null) {
    return (
      <div className={styles.editorEmpty}>
        <p>Open a file from the tree to start editing.</p>
        <p className={styles.hint}>Press Ctrl/Cmd+K for commands.</p>
      </div>
    );
  }

  return (
    <div className={styles.editorWrap}>
      <p className={styles.path}>{activeTab}</p>
      {editor ?? <PlainTextEditor path={activeTab} />}
    </div>
  );
}

/** The Phase 2 editor: a text area over the file, with the same draft and save flow as Monaco. */
function PlainTextEditor({ path }: { path: string }): React.JSX.Element {
  const api = useWorkspaceStoreApi();
  const draft = useWorkspaceStore((state) => state.drafts[path]);
  const saved = useWorkspaceStore((state) => {
    const content = state.fs.read(path);
    return content.ok ? content.value : '';
  });
  return (
    <textarea
      key={path}
      className={styles.textarea}
      aria-label={`Editor: ${path}`}
      spellCheck={false}
      value={draft ?? saved}
      onChange={(event) => {
        api.getState().setDraft(path, event.target.value);
      }}
    />
  );
}
