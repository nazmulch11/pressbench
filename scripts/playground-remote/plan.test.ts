import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { remotePlan } from './plan';

describe('remotePlan', () => {
  it('TC-PG-019a builds the upstream tag of the pinned client outside the project, into a cache folder per version', () => {
    const root = join('/', 'repo');
    const temp = join('/', 'tmp');

    expect(remotePlan('3.1.59', root, temp)).toEqual({
      version: '3.1.59',
      tag: 'v3.1.59',
      sourceDir: join(temp, 'pressbench-playground-src-3.1.59'),
      outDir: join(root, 'scripts', '.cache', 'playground-remote', '3.1.59'),
    });
  });

  it('TC-PG-019b rejects a version range, since the remote must match one exact client', () => {
    expect(() => remotePlan('^3.1.59', '/repo', '/tmp')).toThrow(/exact version/);
    expect(() => remotePlan('latest', '/repo', '/tmp')).toThrow(/exact version/);
  });
});
