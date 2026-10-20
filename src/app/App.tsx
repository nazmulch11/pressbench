import { useEffect } from 'react';

import { FileTree } from '@/features/file-tree';
import { PlaygroundPanel } from '@/features/preview';
import { UploadProjectButton } from '@/features/projects';
import { Workspace } from '@/features/workspace';
import { createLogger } from '@/lib/logger';
import type { PlaygroundService } from '@/lib/playground';
import { WorkspaceStoreProvider, type WorkspaceStore } from '@/stores';

const log = createLogger('ui');

export interface AppProps {
  playground: PlaygroundService;
  /** Created once by `main.tsx` over `localStorage`; tests pass a fresh store. */
  store: WorkspaceStore;
  /**
   * The editor slot. `main.tsx` passes the lazy Monaco editor; component tests leave it out so the workspace
   * falls back to its plain text area (Monaco cannot run in jsdom).
   */
  editor?: React.ReactNode;
}

/**
 * Application shell: the workspace (Phase 2) with the Monaco editor (Phase 3) and the Phase 1 Playground spike
 * panel in the preview area. See docs/IMPLEMENTATION_PLAN.md.
 */
export function App({ playground, store, editor }: AppProps): React.JSX.Element {
  useEffect(() => {
    // Runs after React has committed the shell to the DOM (twice in development under StrictMode).
    log.debug('app mounted');
  }, []);

  return (
    <WorkspaceStoreProvider store={store}>
      <Workspace
        sidebar={<FileTree />}
        editor={editor}
        preview={<PlaygroundPanel service={playground} />}
        headerActions={<UploadProjectButton />}
      />
    </WorkspaceStoreProvider>
  );
}
