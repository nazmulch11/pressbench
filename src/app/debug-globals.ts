import type { LogEntry } from '@/lib/logger';

declare global {
  interface Window {
    /** Recent log entries. Only set when the app runs with `?debug=1` (see docs/DEBUGGING.md). */
    __PRESSBENCH_LOGS__?: readonly LogEntry[];
  }
}

export {};
