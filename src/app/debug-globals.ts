import type { LogEntry } from '@/lib/logger';
import type { PlaygroundService } from '@/lib/playground';
import type { WorkspaceStore } from '@/stores';

declare global {
  interface Window {
    /** Recent log entries. Only set when the app runs with `?debug=1` (see docs/DEBUGGING.md). */
    __PRESSBENCH_LOGS__?: readonly LogEntry[];
    /** Debug handles. Only set when the app runs with `?debug=1` (see docs/DEBUGGING.md section 4). */
    __PRESSBENCH__?: {
      /** The raw Playground client, once WordPress is ready. */
      playground?: unknown;
      playgroundService?: PlaygroundService;
      /** The workspace store (files, tabs, drafts), for inspecting state and counting writes in tests. */
      workspaceStore?: WorkspaceStore;
    };
  }
}

export {};
