import { basename } from '@/lib/fs';
import { useWorkspaceStore, useWorkspaceStoreApi } from '@/stores';
import { Dialog, DialogActions } from '@/ui/Dialog';

import styles from './Workspace.module.css';

/** "Save changes to x?" shown when a tab with a draft is closed. */
export function CloseTabDialog(): React.JSX.Element | null {
  const api = useWorkspaceStoreApi();
  const closing = useWorkspaceStore((state) => state.closing);
  if (closing === null) {
    return null;
  }
  const name = basename(closing);
  return (
    <Dialog
      role="alertdialog"
      title={`Save changes to ${name}?`}
      description="Your changes will be lost if you don't save them."
      onClose={() => {
        api.getState().cancelClose();
      }}
    >
      <DialogActions>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            api.getState().cancelClose();
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            api.getState().discardAndClose(closing);
          }}
        >
          Don&apos;t save
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          data-autofocus
          onClick={() => {
            api.getState().saveAndClose(closing);
          }}
        >
          Save
        </button>
      </DialogActions>
    </Dialog>
  );
}
