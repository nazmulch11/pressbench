import { expect, it } from 'vitest';

// Temporary: proves that a failing test makes CI red (Phase 0 exit gate). Delete after the run.
it('TC-FND-010 deliberately fails to prove CI goes red', () => {
  expect(1).toBe(2);
});
