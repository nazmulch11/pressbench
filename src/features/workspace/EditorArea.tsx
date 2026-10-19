import { useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';

import styles from './Workspace.module.css';

/**
 * Phase 2 stand-in for the editor: a plain text area over the active file. Monaco replaces it in Phase 3; the
 * draft and save flow stays the same.
 */
export function EditorArea(): React.JSX.Element {
  const api = useWorkspaceStoreApi();
  const activeTab = useWorkspaceStore((state) => state.activeTab);
  const draft = useWorkspaceStore((state) =>
    state.activeTab === null ? undefined : state.drafts[state.activeTab],
  );
  const saved = useWorkspaceStore((state) => {
    if (state.activeTab === null) {
      return '';
    }
    const content = state.fs.read(state.activeTab);
    return content.ok ? content.value : '';
  });

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
      <textarea
        key={activeTab}
        className={styles.textarea}
        aria-label={`Editor: ${activeTab}`}
        spellCheck={false}
        value={draft ?? saved}
        onChange={(event) => {
          api.getState().setDraft(activeTab, event.target.value);
        }}
      />
    </div>
  );
}
