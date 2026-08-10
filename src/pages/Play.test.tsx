// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ buy: vi.fn() }));

vi.mock('wagmi', () => ({ useAccount: () => ({ isConnected: true }) }));
vi.mock('@/components/common/ApprovalButton', () => ({ ApprovalButton: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/hooks/useJackpotState', () => ({
  useJackpotState: () => ({ state: { ballMax: 50, bonusballMax: 10, ticketPrice: 1_000_000n }, drawingId: 218n, phase: 'open', refetch: vi.fn() }),
}));
vi.mock('@/hooks/useBuyTickets', () => ({
  useBuyTickets: () => ({ isReady: true, isPending: false, purchasedTickets: [], buy: mocks.buy }),
}));
vi.mock('@/hooks/useBulkPurchase', () => ({
  useBulkPurchase: () => ({ minimumTicketCount: undefined, hasActiveOrder: false, create: { isReady: false, isPending: false }, confirmedTickets: [], orderInfo: [] }),
}));

import { Play } from './Play';

describe('Play', () => {
  afterEach(() => {
    cleanup();
    mocks.buy.mockReset();
  });

  it('starts the direct purchase from Explore without opening a confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<Play />);

    await user.click(screen.getByRole('button', { name: /^Explore 3/ }));

    expect(mocks.buy).toHaveBeenCalledWith({ count: 3, bounds: { ballMax: 50, bonusballMax: 10 }, customTickets: [] });
    expect(screen.queryByRole('dialog', { name: 'Confirm expedition' })).not.toBeInTheDocument();
  });
});
