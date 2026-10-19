import { lazy, Suspense } from 'react';

import { useWorkspaceStore } from '@/stores';

import styles from './CodeEditor.module.css';

/** Monaco and its workers live in this chunk; nothing requests it until a file is open (TC-ED-010). */
const MonacoEditor = lazy(() =>
  import('./MonacoEditor').then((module) => ({ default: module.MonacoEditor })),
);

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
    <Suspense fallback={<p className={styles.loading}>Loading editor…</p>}>
      <MonacoEditor />
    </Suspense>
  );
}
