import { describe, expect, it } from 'vitest';

import { PLAYGROUND_SERVICE_CONTRACT } from '@/test/playground-contract';

import { createFakePlaygroundService } from './fake';

describe('createFakePlaygroundService', () => {
  for (const contractCase of PLAYGROUND_SERVICE_CONTRACT) {
    it(`TC-PG-009${contractCase.suffix} ${contractCase.name}`, async () => {
      const fake = createFakePlaygroundService();

      await expect(contractCase.run(fake)).resolves.toBeUndefined();
    });
  }

  it('TC-PG-009h fails boot with the configured error', async () => {
    const fake = createFakePlaygroundService({ bootError: 'remote unreachable' });

    const result = await fake.boot();

    expect(result).toEqual({
      ok: false,
      error: { kind: 'boot-failed', message: 'remote unreachable' },
    });
    expect(fake.state).toEqual({
      status: 'error',
      error: { kind: 'boot-failed', message: 'remote unreachable' },
    });
  });

  it('TC-PG-009i returns a registered response for other PHP code', async () => {
    const fake = createFakePlaygroundService();
    await fake.boot();
    fake.whenRun('<?php echo PHP_VERSION;', {
      ok: true,
      value: { output: '8.3.0', stderr: '', exitCode: 0 },
    });

    const known = await fake.run('<?php echo PHP_VERSION;');
    const unknown = await fake.run('<?php phpinfo();');

    expect(known).toEqual({ ok: true, value: { output: '8.3.0', stderr: '', exitCode: 0 } });
    expect(unknown).toEqual({ ok: true, value: { output: '', stderr: '', exitCode: 0 } });
  });

  it('TC-PG-009j reports the requested versions once ready', async () => {
    const fake = createFakePlaygroundService();

    await fake.boot({ versions: { wp: '6.8', php: '8.2' } });

    expect(await fake.getVersions()).toEqual({ ok: true, value: { wp: '6.8', php: '8.2' } });
  });

  it('TC-PG-009l reports persistence from the boot options or the configured gap', async () => {
    const fake = createFakePlaygroundService();
    const gap = createFakePlaygroundService({ persistenceUnavailable: 'no OPFS here' });

    const off = await fake.boot();
    const on = await fake.boot({ persist: true });
    const unavailable = await gap.boot({ persist: true });

    expect(off).toMatchObject({ ok: true, value: { persistence: 'off' } });
    expect(on).toMatchObject({ ok: true, value: { persistence: 'on' } });
    expect(unavailable).toMatchObject({
      ok: true,
      value: { persistence: 'unavailable', persistenceReason: 'no OPFS here' },
    });
  });

  it('TC-PG-009m fails a manual boot with failBoot', async () => {
    const fake = createFakePlaygroundService({ boot: 'manual' });
    const booting = fake.boot();

    fake.failBoot('worker crashed');

    expect(await booting).toEqual({
      ok: false,
      error: { kind: 'boot-failed', message: 'worker crashed' },
    });
    expect(fake.state.status).toBe('error');
  });

  it('TC-PG-009k waits for finishBoot when boot is manual', async () => {
    const fake = createFakePlaygroundService({ boot: 'manual' });
    const booting = fake.boot();

    expect(fake.state.status).toBe('booting');
    fake.finishBoot();

    expect((await booting).ok).toBe(true);
    expect(fake.state.status).toBe('ready');
  });
});
