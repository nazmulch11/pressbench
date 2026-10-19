import { useEffect } from 'react';

import { PlaygroundPanel } from '@/features/preview';
import { createLogger } from '@/lib/logger';
import type { PlaygroundService } from '@/lib/playground';

import styles from './App.module.css';

const log = createLogger('ui');

export interface AppProps {
  playground: PlaygroundService;
}

/**
 * Application shell. Phase 1 shows the Playground spike panel; the workspace (file tree, editor, preview)
 * arrives in Phase 2. See docs/IMPLEMENTATION_PLAN.md.
 */
export function App({ playground }: AppProps): React.JSX.Element {
  useEffect(() => {
    // Runs after React has committed the shell to the DOM (twice in development under StrictMode).
    log.debug('app mounted');
  }, []);

  return (
    <main className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Playground spike</p>
        <h1 className={styles.title}>Pressbench</h1>
        <p className={styles.lead}>
          A browser-based IDE for WordPress plugin and theme developers.
        </p>
        <p className={styles.status}>
          WordPress runs in this tab through WordPress Playground. The workspace, editor and live
          preview arrive in the next phases.
        </p>
      </div>
      <PlaygroundPanel service={playground} />
    </main>
  );
}
