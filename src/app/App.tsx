import { useEffect } from 'react';

import { createLogger } from '@/lib/logger';

import styles from './App.module.css';

const log = createLogger('ui');

/**
 * Application shell. Phase 0 shows a placeholder; the workspace (file tree, editor, preview) arrives in
 * Phase 2. See docs/IMPLEMENTATION_PLAN.md.
 */
export function App(): React.JSX.Element {
  useEffect(() => {
    // Runs after React has committed the shell to the DOM (twice in development under StrictMode).
    log.debug('app mounted');
  }, []);

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Foundation build</p>
        <h1 className={styles.title}>Pressbench</h1>
        <p className={styles.lead}>
          A browser-based IDE for WordPress plugin and theme developers.
        </p>
        <p className={styles.status}>
          The workspace, editor and live WordPress preview arrive in the next phases.
        </p>
      </div>
    </main>
  );
}
