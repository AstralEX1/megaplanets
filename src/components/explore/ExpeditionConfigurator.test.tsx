// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExpeditionConfigurator } from './ExpeditionConfigurator';

describe('ExpeditionConfigurator', () => {
  afterEach(cleanup);

  const props = {
    quantity: 3,
    total: 3_000_000n,
    bounds: null,
    manuallyEditedTickets: [],
    automaticQuickPick: true,
    disabled: false,
    onQuantityChange: vi.fn(),
    onAutomaticQuickPickChange: vi.fn(),
    onTicketsChange: vi.fn(),
    onExplore: vi.fn(),
  };

  it('shows only the selected number of preview silhouettes up to three', () => {
    render(<ExpeditionConfigurator
      quantity={1}
      total={1_000_000n}
      bounds={null}
      manuallyEditedTickets={[]}
      automaticQuickPick
      disabled={false}
      onQuantityChange={vi.fn()}
      onAutomaticQuickPickChange={vi.fn()}
      onTicketsChange={vi.fn()}
      onExplore={vi.fn()}
    />);

    expect(screen.getAllByLabelText(/unrevealed planet/i)).toHaveLength(1);
  });

  it('opens and closes coordinates from the desktop arrow', async () => {
    const user = userEvent.setup();
    render(<ExpeditionConfigurator
      quantity={3}
      total={3_000_000n}
      bounds={null}
      manuallyEditedTickets={[]}
      automaticQuickPick
      disabled={false}
      onQuantityChange={vi.fn()}
      onAutomaticQuickPickChange={vi.fn()}
      onTicketsChange={vi.fn()}
      onExplore={vi.fn()}
    />);

    expect(screen.getByRole('button', { name: 'Explore 3 · $3.00 USDC' })).toBeEnabled();

    const [toggle] = screen.getAllByRole('button', { name: 'Open coordinates' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getAllByRole('region', { name: 'Coordinates' })).toHaveLength(2);

    const [closeToggle] = screen.getAllByRole('button', { name: 'Close coordinates' });
    await user.click(closeToggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('applies a Custom quantity after Enter', async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    render(<ExpeditionConfigurator {...props} onQuantityChange={onQuantityChange} />);

    await user.click(screen.getByRole('button', { name: 'Custom quantity' }));
    await user.type(screen.getByLabelText('Custom planet count'), '42{enter}');

    expect(onQuantityChange).toHaveBeenLastCalledWith(42);
  });
});
