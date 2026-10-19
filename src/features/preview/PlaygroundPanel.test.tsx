import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createFakePlaygroundService } from '@/lib/playground';

import { PlaygroundPanel } from './PlaygroundPanel';

describe('PlaygroundPanel', () => {
  it('TC-PG-007 shows the boot error and retries on request', async () => {
    const user = userEvent.setup();
    const fake = createFakePlaygroundService({ bootError: 'remote.html could not be loaded' });
    render(<PlaygroundPanel service={fake} />);

    await user.click(screen.getByRole('button', { name: 'Start WordPress' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Could not start WordPress: remote.html could not be loaded',
    );
    const retry = screen.getByRole('button', { name: 'Retry' });

    fake.bootError = null;
    await user.click(retry);

    expect(screen.getByRole('status')).toHaveTextContent(/^Ready in \d+(\.\d+)? s$/);
  });

  it('TC-PG-010 shows progress while booting and the boot time when ready', async () => {
    const user = userEvent.setup();
    const fake = createFakePlaygroundService({ boot: 'manual' });
    render(<PlaygroundPanel service={fake} />);

    expect(screen.getByRole('status')).toHaveTextContent('Not started');
    expect(screen.getByTitle('WordPress preview')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start WordPress' }));

    expect(screen.getByRole('status')).toHaveTextContent('Starting WordPress…');
    expect(screen.getByRole('button', { name: 'Start WordPress' })).toBeDisabled();

    await act(async () => {
      fake.finishBoot();
      await Promise.resolve();
    });

    expect(screen.getByRole('status')).toHaveTextContent(/^Ready in \d+(\.\d+)? s$/);
    expect(screen.getByRole('button', { name: 'Start WordPress' })).toBeEnabled();
  });

  it('TC-PG-010b says when files will not be kept', async () => {
    const user = userEvent.setup();
    const fake = createFakePlaygroundService({ persistenceUnavailable: 'storage is blocked' });
    render(<PlaygroundPanel service={fake} />);

    await user.click(screen.getByRole('checkbox', { name: 'Keep files between reloads' }));
    await user.click(screen.getByRole('button', { name: 'Start WordPress' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      /^Ready in \d+(\.\d+)? s\. Files will not be kept: storage is blocked$/,
    );
  });

  it('TC-PG-010a passes the chosen versions and persistence to boot', async () => {
    const user = userEvent.setup();
    const fake = createFakePlaygroundService();
    render(<PlaygroundPanel service={fake} />);

    await user.selectOptions(screen.getByRole('combobox', { name: 'WordPress version' }), '6.8');
    await user.selectOptions(screen.getByRole('combobox', { name: 'PHP version' }), '8.2');
    await user.click(screen.getByRole('checkbox', { name: 'Keep files between reloads' }));
    await user.click(screen.getByRole('button', { name: 'Start WordPress' }));

    expect(fake.lastBootOptions).toMatchObject({
      versions: { wp: '6.8', php: '8.2' },
      persist: true,
    });
    expect(fake.lastBootOptions?.iframe).toBe(screen.getByTitle('WordPress preview'));
  });
});
