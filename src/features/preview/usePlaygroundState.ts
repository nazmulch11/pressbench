import { useSyncExternalStore } from 'react';

import type { PlaygroundService, PlaygroundState } from '@/lib/playground';

/** Subscribes a component to the service's state. */
export function usePlaygroundState(service: PlaygroundService): PlaygroundState {
  return useSyncExternalStore(
    (listener) => service.subscribe(listener),
    () => service.state,
    () => service.state,
  );
}
