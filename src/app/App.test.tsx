import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createFakePlaygroundService } from '@/lib/playground';

import { App } from './App';

describe('App', () => {
  it('TC-FND-001a renders the product name as the main heading', () => {
    render(<App playground={createFakePlaygroundService()} />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pressbench' })).toBeInTheDocument();
  });
});
