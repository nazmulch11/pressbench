/**
 * Contract every `PlaygroundService` implementation must honour.
 *
 * The cases are plain data so each test file can wrap them in its own `it()` titles (the docs check needs the
 * test case ID in the title of the file it points at). `fake.test.ts` runs them against the fake (TC-PG-009);
 * `tests/integration/playground.test.ts` runs them against the real service on real PHP in Node.
 */
import { expect } from 'vitest';

import type { PlaygroundService, PlaygroundState } from '@/lib/playground';

export interface ContractCase {
  /** Letter appended to the test case ID, so each case has its own title. */
  readonly suffix: string;
  readonly name: string;
  run(service: PlaygroundService): Promise<void>;
}

/** Directory the contract may write into. Real WordPress accepts anything under wp-content. */
export const CONTRACT_DIR = '/wordpress/wp-content/pressbench-contract';

export const PLAYGROUND_SERVICE_CONTRACT: readonly ContractCase[] = [
  {
    suffix: 'a',
    name: 'starts idle and becomes ready after boot',
    async run(service: PlaygroundService): Promise<void> {
      expect(service.state.status).toBe('idle');

      const result = await service.boot();

      expect(result.ok).toBe(true);
      expect(service.state.status).toBe('ready');
      if (service.state.status === 'ready') {
        expect(service.state.bootMs).toBeGreaterThanOrEqual(0);
        expect(service.state.versions.php).toMatch(/^\d+\.\d+/);
        expect(service.state.versions.wp.length).toBeGreaterThan(0);
      }
    },
  },
  {
    suffix: 'b',
    name: 'run before boot gives a not-booted error',
    async run(service: PlaygroundService): Promise<void> {
      const result = await service.run("<?php echo 'x';");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe('not-booted');
      }
    },
  },
  {
    suffix: 'c',
    name: 'round-trips a file',
    async run(service: PlaygroundService): Promise<void> {
      await service.boot();
      const path = `${CONTRACT_DIR}/round-trip.txt`;

      const written = await service.writeFile(path, 'hello\nwörld');
      const read = await service.readFile(path);
      const exists = await service.fileExists(path);
      const listed = await service.listFiles(CONTRACT_DIR);

      expect(written.ok).toBe(true);
      expect(read).toEqual({ ok: true, value: 'hello\nwörld' });
      expect(exists).toEqual({ ok: true, value: true });
      expect(listed.ok && listed.value.includes('round-trip.txt')).toBe(true);
    },
  },
  {
    suffix: 'd',
    name: 'reports a missing file without throwing',
    async run(service: PlaygroundService): Promise<void> {
      await service.boot();
      const path = `${CONTRACT_DIR}/missing.txt`;

      const read = await service.readFile(path);
      const exists = await service.fileExists(path);

      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.kind).toBe('io');
      }
      expect(exists).toEqual({ ok: true, value: false });
    },
  },
  {
    suffix: 'e',
    name: 'runs PHP and returns its output',
    async run(service: PlaygroundService): Promise<void> {
      await service.boot();

      const result = await service.run("<?php echo 'pressbench';");

      expect(result).toEqual({
        ok: true,
        value: { output: 'pressbench', stderr: '', exitCode: 0 },
      });
    },
  },
  {
    suffix: 'f',
    name: 'notifies subscribers of every state change',
    async run(service: PlaygroundService): Promise<void> {
      const seen: PlaygroundState['status'][] = [];
      const unsubscribe = service.subscribe((state) => seen.push(state.status));

      await service.boot();
      unsubscribe();
      await service.dispose();

      expect(seen).toEqual(['booting', 'ready']);
    },
  },
  {
    suffix: 'g',
    name: 'returns to idle after dispose',
    async run(service: PlaygroundService): Promise<void> {
      await service.boot();

      await service.dispose();

      expect(service.state.status).toBe('idle');
      const result = await service.run("<?php echo 'x';");
      expect(result.ok).toBe(false);
    },
  },
];
