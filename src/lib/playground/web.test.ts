import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PERSISTENT_DIR } from './types';
import { createWebPlaygroundService, DEFAULT_REMOTE_URL } from './web';

const startPlaygroundWeb = vi.hoisted(() => vi.fn());

vi.mock('@wp-playground/client', () => ({ startPlaygroundWeb }));

const encoder = new TextEncoder();

function fakeClient() {
  return {
    isReady: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue({
      bytes: encoder.encode(JSON.stringify({ wp: '6.8.2', php: '8.3.33' })),
      errors: '',
      exitCode: 0,
    }),
    mkdirTree: vi.fn().mockResolvedValue(undefined),
    mountOpfs: vi.fn().mockResolvedValue(undefined),
    flushOpfs: vi.fn().mockResolvedValue(undefined),
    goTo: vi.fn().mockResolvedValue(undefined),
    getCurrentURL: vi.fn().mockResolvedValue('https://playground.wordpress.net/scope:1/'),
  };
}

describe('createWebPlaygroundService', () => {
  let client: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    client = fakeClient();
    startPlaygroundWeb.mockReset().mockResolvedValue(client);
  });

  it('TC-PG-013a boots the hosted remote with a Blueprint for the chosen versions', async () => {
    const iframe = document.createElement('iframe');
    const onClientConnected = vi.fn();
    const service = createWebPlaygroundService({ onClientConnected });

    const result = await service.boot({ iframe, versions: { wp: '6.8', php: '8.2' } });

    expect(result).toMatchObject({
      ok: true,
      value: { versions: { wp: '6.8.2', php: '8.3.33' }, persistence: 'off' },
    });
    expect(startPlaygroundWeb).toHaveBeenCalledWith({
      iframe,
      remoteUrl: DEFAULT_REMOTE_URL,
      blueprint: {
        preferredVersions: { php: '8.2', wp: '6.8' },
        login: true,
        landingPage: '/',
        features: { networking: false },
      },
      onClientConnected,
    });
    expect(client.isReady).toHaveBeenCalledOnce();
    expect(client.mountOpfs).not.toHaveBeenCalled();
  });

  it('TC-PG-013b mounts the persistent folder on OPFS and flushes it on persist', async () => {
    const service = createWebPlaygroundService({ remoteUrl: 'http://localhost:9999/remote.html' });

    const booted = await service.boot({ iframe: document.createElement('iframe'), persist: true });
    const persisted = await service.persist();

    expect(booted).toMatchObject({ ok: true, value: { persistence: 'on' } });
    expect(startPlaygroundWeb).toHaveBeenCalledWith(
      expect.objectContaining({ remoteUrl: 'http://localhost:9999/remote.html' }),
    );
    expect(client.mkdirTree).toHaveBeenCalledWith(PERSISTENT_DIR);
    expect(client.mountOpfs).toHaveBeenCalledWith({
      mountpoint: PERSISTENT_DIR,
      device: { type: 'opfs', path: '/pressbench/spike' },
      initialSyncDirection: 'opfs-to-memfs',
    });
    expect(persisted).toEqual({ ok: true, value: undefined });
    expect(client.flushOpfs).toHaveBeenCalledWith(PERSISTENT_DIR);
  });

  it('TC-PG-013c navigates and reads the URL through the client', async () => {
    const service = createWebPlaygroundService();
    await service.boot({ iframe: document.createElement('iframe') });

    await service.goTo('/wp-admin/');
    const url = await service.getCurrentUrl();

    expect(client.goTo).toHaveBeenCalledWith('/wp-admin/');
    expect(url).toEqual({ ok: true, value: 'https://playground.wordpress.net/scope:1/' });
  });

  it('TC-PG-013f reports persistence as unavailable when the OPFS mount fails', async () => {
    client.mountOpfs.mockRejectedValue(
      new Error('The operation failed for an unknown transient reason'),
    );
    const service = createWebPlaygroundService();

    const booted = await service.boot({ iframe: document.createElement('iframe'), persist: true });
    const persisted = await service.persist();

    expect(booted).toMatchObject({
      ok: true,
      value: {
        persistence: 'unavailable',
        persistenceReason: 'The operation failed for an unknown transient reason',
      },
    });
    expect(service.state).toMatchObject({ status: 'ready', persistence: 'unavailable' });
    expect(persisted).toEqual({
      ok: false,
      error: {
        kind: 'unknown',
        message:
          'Files are not kept in this browser: The operation failed for an unknown transient reason',
      },
    });
    expect(client.flushOpfs).not.toHaveBeenCalled();
  });

  it('TC-PG-013e fails the boot when the remote never becomes ready', async () => {
    vi.useFakeTimers();
    try {
      startPlaygroundWeb.mockReturnValue(new Promise(() => undefined));
      const service = createWebPlaygroundService({ bootTimeoutMs: 5_000 });

      const booting = service.boot({ iframe: document.createElement('iframe') });
      await vi.advanceTimersByTimeAsync(5_000);

      expect(await booting).toEqual({
        ok: false,
        error: {
          kind: 'boot-failed',
          message: 'WordPress did not start within 5 s. Check the network and try again.',
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('TC-PG-013d fails to boot without an iframe', async () => {
    const service = createWebPlaygroundService();

    const result = await service.boot();

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'boot-failed',
        message: 'An iframe is required to start WordPress in the browser',
      },
    });
    expect(startPlaygroundWeb).not.toHaveBeenCalled();
  });
});
