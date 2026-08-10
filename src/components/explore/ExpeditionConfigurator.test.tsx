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

  it('shows a single selected planet in the static depth stack', () => {
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

    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(1);
  });

  it('shows every selected planet in a static depth stack without carousel controls', () => {
    render(<ExpeditionConfigurator {...props} quantity={5} />);

    expect(screen.getByRole('group', { name: 'Selected planets visualization' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /previous slide|next slide/i })).not.toBeInTheDocument();
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
