// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  account: {
    address: '0x0000000000000000000000000000000000000001' as `0x${string}` | undefined,
    isConnected: true,
  },
  tickets: [
    {
      ticketId: 24n,
      drawingId: 218n,
      normals: [4, 11, 17, 26, 39],
      bonusBall: 66,
      originTxHash: '0x1234',
      logIndex: 0n,
    },
    {
      ticketId: 25n,
      drawingId: 218n,
      normals: [5, 12, 18, 27, 40],
      bonusBall: 67,
      originTxHash: '0x1235',
      logIndex: 1n,
    },
  ],
  planets: [
    {
      tokenId: '7',
      ticketId: '24',
      mintedAt: '2026-08-01T00:00:00.000Z',
      ticket: {
        drawingId: '218',
        normals: [4, 11, 17, 26, 39],
        bonusBall: 66,
        originTxHash: '0x1234',
      },
    },
    {
      tokenId: '8',
      ticketId: '25',
      mintedAt: '2026-08-03T00:00:00.000Z',
      ticket: {
        drawingId: '218',
        normals: [5, 12, 18, 27, 40],
        bonusBall: 67,
        originTxHash: '0x1235',
      },
    },
  ],
  indexedLoading: false,
  indexedError: undefined as Error | undefined,
  statuses: new Map<string, object>(),
  refetchStatuses: vi.fn(),
  claim: vi.fn(),
  claimSuccess: false,
  mining: {
    ownerAddress: '0x0000000000000000000000000000000000000001',
    asOf: '2026-08-10T00:00:01.000Z',
    ownedPlanetCount: 2,
    pendingMicros: '3100000',
    earnedMicros: '10100000',
    effectiveMineralsPerDayMicros: '104000000',
    planets: [
      {
        tokenId: '7',
        baseMineralsPerDay: '24',
        multiplierBps: '10500',
        effectiveMineralsPerDayMicros: '25200000',
        pendingMicros: '1000000',
        earnedMicros: '4000000',
        activeSince: '2026-08-10T00:00:00.000Z',
      },
      {
        tokenId: '8',
        baseMineralsPerDay: '80',
        multiplierBps: '10000',
        effectiveMineralsPerDayMicros: '80000000',
        pendingMicros: '2100000',
        earnedMicros: '6100000',
        activeSince: '2026-08-10T00:00:00.000Z',
      },
    ],
  },
}));

vi.mock('wagmi', () => ({
  useAccount: () => state.account,
}));
vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: {
    Custom: ({ children }: { children: (props: object) => React.ReactNode }) =>
      children({ account: undefined, chain: undefined, mounted: true, openConnectModal: vi.fn() }),
  },
}));
vi.mock('@megaplanets/planet-generator', () => ({
  derivePlanetPreview: ({
    ticketId,
    drawingId,
    normals,
    bonusBall,
  }: {
    ticketId: bigint;
    drawingId: bigint;
    normals: number[];
    bonusBall: number;
  }) => ({
    descriptor: {
      input: { ticketId, drawingId, normals, bonusBall },
      traits:
        ticketId === 24n
          ? {
              name: 'Kepler',
              type: 'Gaia',
              terrain: 'pixel-continents',
              rarity: 'Epic',
              minerals: 24,
              satelliteCount: 1,
              hasRing: false,
            }
          : {
              name: 'Astra',
              type: 'Volcanic',
              terrain: 'ridged',
              rarity: 'Legendary',
              minerals: 80,
              satelliteCount: 2,
              hasRing: true,
            },
      seed: '0x1234',
      traitsHash: '0x5678',
    },
    visual: { input: { ticketId }, traits: { hasClouds: true } },
  }),
}));
vi.mock('@/config/planetSeason', () => ({ PLANET_SEASON: { seasonId: '0x01' } }));
vi.mock('@/hooks/useEligiblePlanetTickets', () => ({
  useEligiblePlanetTickets: () => ({ tickets: state.tickets, isLoading: false }),
}));
vi.mock('@/hooks/useIndexedPlanets', () => ({
  useIndexedPlanets: () => ({
    planets: state.planets,
    isLoading: state.indexedLoading,
    error: state.indexedError,
  }),
}));
vi.mock('@/hooks/useWalletMining', () => ({
  useWalletMining: () => ({ data: state.mining, isLoading: false, error: undefined }),
}));
vi.mock('@/hooks/usePlanetTicketStatuses', () => ({
  usePlanetTicketStatuses: () => ({
    statuses: state.statuses,
    isLoading: false,
    error: undefined,
    refetch: state.refetchStatuses,
  }),
}));
vi.mock('@/hooks/useClaimWinnings', () => ({
  useClaimWinnings: () => ({
    claim: state.claim,
    isPending: false,
    isSuccess: state.claimSuccess,
    reset: vi.fn(),
  }),
}));
vi.mock('@/hooks/useJackpotState', () => ({
  useJackpotState: () => ({
    drawingId: 219n,
    phase: 'open',
    state: { drawingTime: 2_000_000_000n },
    isLoading: false,
  }),
}));
vi.mock('@/lib/purchaseReceipt', () => ({
  PURCHASED_TICKETS_UPDATED_EVENT: 'tickets-updated',
  readPersistedPurchasedTickets: () => ({ tickets: [], invalidKeys: [] }),
}));
vi.mock('@/components/planets/PlanetThumbnail', () => ({
  PlanetThumbnail: ({ descriptor }: { descriptor: { input: { ticketId: bigint } } }) => (
    <span>Pixel preview {descriptor.input.ticketId.toString()}</span>
  ),
}));
vi.mock('@/components/planets/PlanetGif', () => ({
  PlanetGif: ({ preview }: { preview: { descriptor: { input: { ticketId: bigint } } } }) => (
    <span>Animated preview {preview.descriptor.input.ticketId.toString()}</span>
  ),
}));
vi.mock('@/components/planets/MintPlanetButton', () => ({
  MintPlanetButton: ({ buttonLabel }: { buttonLabel?: string }) => (
    <button type="button">{buttonLabel}</button>
  ),
}));
vi.mock('@/components/planets/MintPlanetBatchButton', () => ({
  MintPlanetBatchButton: ({
    planets,
    buttonLabel,
    onMinted,
  }: {
    planets: readonly { preview: { descriptor: { input: { ticketId: bigint } } } }[];
    buttonLabel?: string;
    onMinted?: (ticketIds: readonly bigint[]) => void;
  }) => (
    <button
      type="button"
      onClick={() => onMinted?.(planets.map(({ preview }) => preview.descriptor.input.ticketId))}
    >
      {buttonLabel}
    </button>
  ),
}));

import { Planets } from './Planets';

describe('Planets', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    state.account = { address: '0x0000000000000000000000000000000000000001', isConnected: true };
    state.tickets = [
      {
        ticketId: 24n,
        drawingId: 218n,
        normals: [4, 11, 17, 26, 39],
        bonusBall: 66,
        originTxHash: '0x1234',
        logIndex: 0n,
      },
      {
        ticketId: 25n,
        drawingId: 218n,
        normals: [5, 12, 18, 27, 40],
        bonusBall: 67,
        originTxHash: '0x1235',
        logIndex: 1n,
      },
    ];
    state.planets = [
      {
        tokenId: '7',
        ticketId: '24',
        mintedAt: '2026-08-01T00:00:00.000Z',
        ticket: {
          drawingId: '218',
          normals: [4, 11, 17, 26, 39],
          bonusBall: 66,
          originTxHash: '0x1234',
        },
      },
      {
        tokenId: '8',
        ticketId: '25',
        mintedAt: '2026-08-03T00:00:00.000Z',
        ticket: {
          drawingId: '218',
          normals: [5, 12, 18, 27, 40],
          bonusBall: 67,
          originTxHash: '0x1235',
        },
      },
    ];
    state.indexedLoading = false;
    state.indexedError = undefined;
    state.statuses = new Map([
      ['24', { kind: 'claim', amount: 12_500_000n, ticketId: 24n }],
      ['25', { kind: 'drawn' }],
    ]);
    state.refetchStatuses.mockReset();
    state.claim.mockReset();
    state.claimSuccess = false;
  });

  afterEach(cleanup);

  it('shows collection totals and all working sort choices', () => {
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'My Planets' })).toBeInTheDocument();
    expect(screen.getByText('2 planets')).toBeInTheDocument();
    expect(screen.getByText(/Mined 10\.1/)).toBeInTheDocument();
    expect(screen.getByText(/104\/day/)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Minerals' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/minerals\/day/i)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Newest' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Oldest' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Minerals' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rarity' })).toBeInTheDocument();

    const collection = screen.getByRole('region', { name: 'Planet collection' });
    expect(
      within(collection)
        .getAllByRole('button', { name: /Select/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Select Astra', 'Select Kepler']);
    fireEvent.change(screen.getByLabelText('Sort planets'), { target: { value: 'oldest' } });
    expect(
      within(collection)
        .getAllByRole('button', { name: /Select/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Select Kepler', 'Select Astra']);
  });

  it('reveals canonical unrevealed tickets in explicit batches of 50 plus the remainder', () => {
    state.tickets = Array.from({ length: 68 }, (_, index) => ({
      ticketId: BigInt(100 + index),
      drawingId: 218n,
      normals: [4, 11, 17, 26, 39],
      bonusBall: 66,
      originTxHash: `0x${(index + 1).toString(16).padStart(64, '0')}`,
      logIndex: BigInt(index),
    }));
    state.planets = [];
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reveal all (68)' }));
    expect(screen.getByRole('button', { name: 'Reveal all (18)' })).toBeInTheDocument();
  });

  it('preserves the selected planet while sorting and routes View details by token ID', () => {
    const onViewPlanet = vi.fn();
    render(<Planets onNavigate={vi.fn()} onViewPlanet={onViewPlanet} />);

    screen.getByRole('button', { name: 'Select Kepler' }).click();
    fireEvent.change(screen.getByLabelText('Sort planets'), { target: { value: 'rarity' } });
    expect(
      screen.getByRole('button', { name: 'Select Kepler' }).closest('article'),
    ).toHaveAttribute('data-selected', 'true');
    screen.getByRole('button', { name: 'View details' }).click();
    expect(onViewPlanet).toHaveBeenCalledWith('7');
  });

  it('opens the full-page detail route when a revealed card is tapped on mobile', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const onViewPlanet = vi.fn();
    render(<Planets onNavigate={vi.fn()} onViewPlanet={onViewPlanet} />);

    screen.getByRole('button', { name: 'Select Kepler' }).click();
    expect(onViewPlanet).toHaveBeenCalledWith('7');
  });

  it('selects an unrevealed ticket and shows only its purchased coordinates', () => {
    state.planets = [state.planets[0] as (typeof state.planets)[number]];
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select unrevealed Ticket #25' }));
    const detail = screen.getByRole('complementary', { name: 'Selected planet detail' });
    expect(detail).toHaveClass('lg:max-h-[calc(100vh-8rem)]', 'lg:overflow-y-auto');
    expect(within(detail).getByText('Ticket #25')).toBeInTheDocument();
    expect(within(detail).getByText('5')).toBeInTheDocument();
    expect(
      within(detail).getByText('67', { selector: '[data-coordinate="bonus"]' }),
    ).toBeInTheDocument();
    expect(within(detail).queryByText('Astra')).not.toBeInTheDocument();
  });

  it('claims the selected winning ticket with its real on-chain ticket ID', () => {
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select Kepler' }));
    fireEvent.click(screen.getByRole('button', { name: 'Claim ($12.50)' }));
    expect(state.claim).toHaveBeenCalledWith([24n]);
  });

  it('renders a full-page detail route and returns to My Planets', () => {
    const onNavigate = vi.fn();
    render(<Planets onNavigate={onNavigate} onViewPlanet={vi.fn()} routePlanetId="7" />);

    expect(screen.queryByRole('region', { name: 'Planet collection' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kepler' })).toBeInTheDocument();
    screen.getByRole('button', { name: '← Back to My Planets' }).click();
    expect(onNavigate).toHaveBeenCalledWith('planets');
  });

  it('does not call a direct Planet route missing while the index is still loading', () => {
    state.planets = [];
    state.indexedLoading = true;
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} routePlanetId="7" />);

    expect(screen.getByRole('heading', { name: 'Loading planet details' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Planet not found' })).not.toBeInTheDocument();
  });

  it('distinguishes an unavailable index from an empty wallet', () => {
    state.tickets = [];
    state.planets = [];
    state.indexedError = new Error('offline');
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'Planet collection unavailable' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No planets yet' })).not.toBeInTheDocument();
  });

  it('shows the requested empty state action', () => {
    state.tickets = [];
    state.planets = [];
    const onNavigate = vi.fn();
    render(<Planets onNavigate={onNavigate} onViewPlanet={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'No planets yet' })).toBeInTheDocument();
    screen.getByRole('button', { name: 'Explore planets' }).click();
    expect(onNavigate).toHaveBeenCalledWith('play');
  });

  it('shows the existing wallet connect action when disconnected', () => {
    state.account = { address: undefined, isConnected: false };
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(screen.getByText('Connect your wallet to view your planets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeInTheDocument();
  });
});
