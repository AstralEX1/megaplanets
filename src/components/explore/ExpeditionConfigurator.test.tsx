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

  it('renders the live jackpot as the depth headline', () => {
    const { container } = render(
      <ExpeditionConfigurator {...props} jackpotAmount={123_456_000n} />,
    );

    expect(screen.getByRole('heading', { name: 'Win up to $123.46' })).toBeInTheDocument();
    expect(container.querySelectorAll('.depth-text__layer')).toHaveLength(28);
    expect(container.querySelector('.depth-text')).toHaveStyle({
      '--depth-text-perspective': '1500px',
      '--depth-text-font-weight': '950',
      '--depth-text-face-color': '#f8fafc',
    });
    expect(container.querySelector('.depth-text__layer')).toHaveStyle({
      transform: 'translateZ(-42px)',
    });
  });

  it('shows a single selected planet in the static depth stack', () => {
    render(
      <ExpeditionConfigurator
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
      />,
    );

    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(1);
  });

  it('shows every selected planet in a static depth stack without carousel controls', () => {
    render(<ExpeditionConfigurator {...props} quantity={5} />);

    expect(
      screen.getByRole('group', { name: 'Selected planets visualization' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(5);
    expect(
      screen.queryByRole('button', { name: /previous slide|next slide/i }),
    ).not.toBeInTheDocument();
  });

  it('replaces the Explore copy with inline purchase progress', () => {
    render(<ExpeditionConfigurator {...props} exploreLabel="Confirming purchase…" disabled />);

    expect(screen.getByRole('heading', { name: 'Win up to $0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirming purchase…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Explore 3/ })).not.toBeInTheDocument();
  });

  it('opens and closes coordinates from the desktop arrow', async () => {
    const user = userEvent.setup();
    render(
      <ExpeditionConfigurator
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
      />,
    );

    expect(screen.getByRole('button', { name: 'Explore 3 · $3.00 USDC' })).toBeEnabled();

    expect(screen.getByTestId('expedition-core')).toHaveAttribute('data-layout-anchor', 'fixed');
    expect(screen.getByTestId('expedition-core')).toHaveClass('max-w-[840px]');
    expect(screen.getByTestId('coordinates-disclosure')).toHaveAttribute('data-side', 'right');

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
