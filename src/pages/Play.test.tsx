// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buy: vi.fn(),
  directTickets: [] as Array<Record<string, unknown>>,
  eligibleTickets: [] as Array<Record<string, unknown>>,
  indexedPlanets: [] as Array<{ ticketId: string | null }>,
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000001',
    isConnected: true,
  }),
}));
vi.mock('@megaplanets/planet-generator', () => ({
  createSeason1Config: () => ({}),
  derivePlanetPreview: () => ({ descriptor: { input: { ticketId: 34n }, traits: { name: 'Astraea', type: 'Nebula', rarity: 'Rare', minerals: 34 } }, visual: { input: { ticketId: 34n } } }),
  renderPlanetFrame: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('@/components/common/ApprovalButton', () => ({ ApprovalButton: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/planets/MintPlanetButton', () => ({ MintPlanetButton: ({ buttonLabel }: { buttonLabel?: string }) => <button type="button">{buttonLabel}</button> }));
vi.mock('@/components/planets/MintPlanetBatchButton', () => ({ MintPlanetBatchButton: ({ buttonLabel }: { buttonLabel?: string }) => <button type="button">{buttonLabel}</button> }));
vi.mock('@/hooks/useJackpotState', () => ({
  useJackpotState: () => ({ state: { ballMax: 50, bonusballMax: 10, ticketPrice: 1_000_000n }, drawingId: 218n, phase: 'open', refetch: vi.fn() }),
}));
vi.mock('@/hooks/useBuyTickets', () => ({
  useBuyTickets: () => ({ isReady: true, isPending: false, purchasedTickets: mocks.directTickets, buy: mocks.buy }),
}));
vi.mock('@/hooks/useEligiblePlanetTickets', () => ({
  useEligiblePlanetTickets: () => ({ tickets: mocks.eligibleTickets }),
}));
vi.mock('@/hooks/useIndexedPlanets', () => ({
  useIndexedPlanets: () => ({ planets: mocks.indexedPlanets }),
}));
vi.mock('@/hooks/useBulkPurchase', () => ({
  useBulkPurchase: () => ({ minimumTicketCount: undefined, hasActiveOrder: false, create: { isReady: false, isPending: false }, confirmedTickets: [], orderInfo: [] }),
}));

import { Play } from './Play';

describe('Play', () => {
  afterEach(() => {
    cleanup();
    mocks.buy.mockReset();
    mocks.directTickets = [];
    mocks.eligibleTickets = [];
    mocks.indexedPlanets = [];
  });

  it('starts the direct purchase from Explore without opening a confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<Play />);

    expect(screen.queryByText(/DRAWING/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Explore 3/ }));

    expect(mocks.buy).toHaveBeenCalledWith({ count: 3, bounds: { ballMax: 50, bonusballMax: 10 }, customTickets: [] });
    expect(screen.queryByRole('dialog', { name: 'Confirm expedition' })).not.toBeInTheDocument();
  });

  it('shows the expedition-complete screen after ticket receipt data is confirmed', () => {
    mocks.directTickets = [{ ticketId: 34n, drawingId: 218n, normals: [1, 2, 3, 4, 5], bonusBall: 1, originTxHash: '0x1234', logIndex: 0n }];
    render(<Play />);

    expect(screen.getByText('EXPEDITION COMPLETE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You found 1 planet!' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers reveal when a completed bulk purchase is recovered from chain history', () => {
    mocks.eligibleTickets = [{
      ticketId: 34n,
      drawingId: 218n,
      normals: [1, 2, 3, 4, 5],
      bonusBall: 1,
      originTxHash: `0x${'1'.repeat(64)}`,
      logIndex: 4n,
    }];

    render(<Play />);

    expect(screen.getByText('EXPEDITION COMPLETE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'REVEAL (1)' })).toBeInTheDocument();
  });
});
