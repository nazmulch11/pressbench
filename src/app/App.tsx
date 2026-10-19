import { useEffect, useState } from 'react';

import { FileTree } from '@/features/file-tree';
import { PlaygroundPanel } from '@/features/preview';
import { Workspace } from '@/features/workspace';
import { createLogger } from '@/lib/logger';
import type { PlaygroundService } from '@/lib/playground';
import { browserLocalStorage, createPreferences } from '@/lib/storage';
import { createWorkspaceStore, WorkspaceStoreProvider, type WorkspaceStore } from '@/stores';

const log = createLogger('ui');

export interface AppProps {
  playground: PlaygroundService;
  /** Injected by tests; the app creates its own over `localStorage`. */
  store?: WorkspaceStore;
}

/**
 * Application shell: the Phase 2 workspace with the Phase 1 Playground spike panel in the preview area.
 * See docs/IMPLEMENTATION_PLAN.md.
 */
export function App({ playground, store }: AppProps): React.JSX.Element {
  const [workspaceStore] = useState(
    () => store ?? createWorkspaceStore({ preferences: createPreferences(browserLocalStorage()) }),
  );

  useEffect(() => {
    // Runs after React has committed the shell to the DOM (twice in development under StrictMode).
    log.debug('app mounted');
  }, []);

  return (
    <WorkspaceStoreProvider store={workspaceStore}>
      <Workspace sidebar={<FileTree />} preview={<PlaygroundPanel service={playground} />} />
    </WorkspaceStoreProvider>
  );
}
