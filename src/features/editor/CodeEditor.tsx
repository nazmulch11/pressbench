import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';

import { createLogger } from '@/lib/logger';
import { useWorkspaceStore } from '@/stores';

import styles from './CodeEditor.module.css';

const log = createLogger('editor');

/** Monaco and its workers live in this chunk; nothing requests it until a file is open (TC-ED-010). */
const MonacoEditor = lazy(() =>
  import('./MonacoEditor').then((module) => ({ default: module.MonacoEditor })),
);

const LOAD_FAILED =
  'The editor could not be loaded. Your files and unsaved changes are still here; reload the page to try again.';

/**
 * Keeps a failure inside the editor slot (TC-ED-028): a Monaco chunk that cannot be downloaded, for example after a
 * deploy replaced it, or an error thrown while the editor renders, would otherwise unmount the whole workspace and
 * lose the in-memory project.
 */
class EditorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error('editor failed', {
      message: error.message,
      componentStack: info.componentStack ?? '',
    });
  }

  override render(): ReactNode {
    return this.state.failed ? (
      <p role="alert" className={styles.loading}>
        {LOAD_FAILED}
      </p>
    ) : (
      this.props.children
    );
  }
}

/**
 * The editor slot of the workspace: loads Monaco the first time a file is open and shows a short loading line
 * meanwhile. Renders nothing without an active tab, so the workspace's empty state stays in charge.
 */
export function CodeEditor(): React.JSX.Element | null {
  const hasActiveTab = useWorkspaceStore((state) => state.activeTab !== null);
  if (!hasActiveTab) {
    return null;
  }
  return (
    <EditorBoundary>
      <Suspense fallback={<p className={styles.loading}>Loading editor…</p>}>
        <MonacoEditor />
      </Suspense>
    </EditorBoundary>
  );
}
