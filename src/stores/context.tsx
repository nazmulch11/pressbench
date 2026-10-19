import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';

import type { WorkspaceState, WorkspaceStore } from './workspace-store';

const WorkspaceStoreContext = createContext<WorkspaceStore | null>(null);

export interface WorkspaceStoreProviderProps {
  store: WorkspaceStore;
  children: ReactNode;
}

/** Makes one workspace store available to the components below it. */
export function WorkspaceStoreProvider({
  store,
  children,
}: WorkspaceStoreProviderProps): React.JSX.Element {
  return <WorkspaceStoreContext.Provider value={store}>{children}</WorkspaceStoreContext.Provider>;
}

/** The store from the nearest provider. Throws when there is none: that is a wiring bug, not a runtime state. */
export function useWorkspaceStoreApi(): WorkspaceStore {
  const store = useContext(WorkspaceStoreContext);
  if (store === null) {
    throw new Error('useWorkspaceStore must be used inside <WorkspaceStoreProvider>');
  }
  return store;
}

/** Subscribes to a slice of the workspace state. */
export function useWorkspaceStore<T>(selector: (state: WorkspaceState) => T): T {
  return useStore(useWorkspaceStoreApi(), selector);
}
