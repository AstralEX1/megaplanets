// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buy: vi.fn(),
  bulkCreateOrder: vi.fn(),
  account: {
    address: '0x0000000000000000000000000000000000000001',
    isConnected: true,
  },
  chainId: 84532,
  directTickets: [] as Array<Record<string, unknown>>,
  bulkTickets: [] as Array<Record<string, unknown>>,
  eligibleTickets: [] as Array<Record<string, unknown>>,
  indexedPlanets: [] as Array<{ ticketId: string | null }>,
}));

vi.mock('wagmi', () => ({
  useChainId: () => mocks.chainId,
  useAccount: () => mocks.account,
}));
vi.mock('@megaplanets/planet-generator', () => ({
  createPlanetConfig: () => ({}),
  derivePlanetPreview: ({ ticketId, drawingId }: { ticketId: bigint; drawingId: bigint }) => ({
    descriptor: {
      input: { ticketId, drawingId },
      traits: { name: 'Astraea', type: 'Nebula', rarity: 'Rare', minerals: 34 },
    },
    visual: { input: { ticketId } },
  }),
  renderPlanetFrame: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
}));
vi.mock('@/components/common/ApprovalButton', () => ({
  ApprovalButton: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/planets/PlanetThumbnail', () => ({
  PlanetThumbnail: ({ descriptor }: { descriptor: { input: { ticketId: bigint } } }) => (
    <span>Planet artwork {descriptor.input.ticketId.toString()}</span>
  ),
}));
vi.mock('@/components/planets/MintPlanetButton', () => ({
  MintPlanetButton: ({
    buttonLabel,
    preview,
    onMinted,
    onStateChange,
  }: {
    buttonLabel?: string;
    preview: { descriptor: { input: { ticketId: bigint } } };
    onMinted?: (ticketId: bigint) => void;
    onStateChange?: (state: string) => void;
  }) => (
    <div>
      <button type="button">{buttonLabel}</button>
      <button type="button" onClick={() => onStateChange?.('wallet-confirmation')}>
        Begin reveal
      </button>
      <button
        type="button"
        onClick={() => {
          onMinted?.(preview.descriptor.input.ticketId);
          onStateChange?.('complete');
        }}
      >
        Complete reveal
      </button>
    </div>
  ),
}));
vi.mock('@/components/planets/MintPlanetBatchButton', () => ({
  MintPlanetBatchButton: ({ buttonLabel }: { buttonLabel?: string }) => (
    <button type="button">{buttonLabel}</button>
  ),
}));
vi.mock('@/hooks/useJackpotState', () => ({
  useJackpotState: () => ({
    state: { ballMax: 50, bonusballMax: 10, ticketPrice: 1_000_000n },
    drawingId: 218n,
    phase: 'open',
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useBuyTickets', () => ({
  useBuyTickets: () => ({
    isReady: true,
    isPending: false,
    purchasedTickets: mocks.directTickets,
    buy: mocks.buy,
    reset: vi.fn(),
  }),
}));
vi.mock('@/hooks/useEligiblePlanetTickets', () => ({
  useEligiblePlanetTickets: () => ({ tickets: mocks.eligibleTickets }),
}));
vi.mock('@/hooks/useIndexedPlanets', () => ({
  useIndexedPlanets: () => ({ planets: mocks.indexedPlanets }),
}));
vi.mock('@/hooks/usePlanetTicketStatuses', () => ({
  usePlanetTicketStatuses: () => ({
    statuses: new Map(),
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useBulkPurchase', () => ({
  useBulkPurchase: () => ({
    minimumTicketCount: undefined,
    hasActiveOrder: false,
    createOrder: mocks.bulkCreateOrder,
    cancelOrder: vi.fn(),
    create: {
      isReady: false,
      isPending: false,
      isWaitingSignature: false,
      isPreparing: false,
      isMining: false,
      isSuccess: false,
      error: null,
      reset: vi.fn(),
    },
    cancel: { isPending: false },
    confirmedTickets: mocks.bulkTickets,
    orderInfo: [],
  }),
}));

import { Play } from './Play';

describe('Play', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    mocks.buy.mockReset();
    mocks.bulkCreateOrder.mockReset();
    mocks.account = {
      address: '0x0000000000000000000000000000000000000001',
      isConnected: true,
    };
    mocks.chainId = 84532;
    mocks.directTickets = [];
    mocks.bulkTickets = [];
    mocks.eligibleTickets = [];
    mocks.indexedPlanets = [];
  });

  it('starts the direct purchase from Explore without opening a confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<Play />);

    expect(screen.queryByText(/DRAWING/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Explore 3/ }));

    expect(mocks.buy).toHaveBeenCalledWith({
      count: 3,
      bounds: { ballMax: 50, bonusballMax: 10 },
      customTickets: [],
    });
    expect(screen.queryByRole('dialog', { name: 'Confirm expedition' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Win up to $0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm in wallet' })).toBeDisabled();
  });

  it('shows the expedition-complete screen after ticket receipt data is confirmed', async () => {
    const user = userEvent.setup();
    mocks.directTickets = [34n, 35n, 36n].map((ticketId, logIndex) => ({
      ticketId,
      drawingId: 218n,
      normals: [1, 2, 3, 4, 5],
      bonusBall: 1,
      originTxHash: '0x1234',
      logIndex: BigInt(logIndex),
    }));
    render(<Play />);

    await user.click(screen.getByRole('button', { name: /^Explore 3/ }));

    expect(screen.getByText('EXPEDITION COMPLETE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You found 3 planets!' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps mystery planets visible during reveal and shows My Planets cards only after success', async () => {
    const user = userEvent.setup();
    mocks.directTickets = [
      {
        ticketId: 34n,
        drawingId: 218n,
        normals: [1, 2, 3, 4, 5],
        bonusBall: 1,
        originTxHash: '0x1234',
        logIndex: 0n,
      },
    ];
    render(<Play />);

    await user.click(screen.getByRole('button', { name: 'Custom quantity' }));
    await user.type(screen.getByLabelText('Custom planet count'), '1{enter}');
    await user.click(screen.getByRole('button', { name: /^Explore 1/ }));
    expect(screen.getByRole('heading', { name: 'You found 1 planet!' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Begin reveal' }));
    expect(screen.getByRole('heading', { name: 'You found 1 planet!' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Reveal in your wallet' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText('Complete reveal'));
    expect(
      screen.getByRole('heading', { name: 'Your new planets are ready.' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Astraea' })).toBeInTheDocument();
  });

  it('does not let recovered history automatically take over Play', () => {
    mocks.eligibleTickets = [
      {
        ticketId: 34n,
        drawingId: 218n,
        normals: [1, 2, 3, 4, 5],
        bonusBall: 1,
        originTxHash: `0x${'1'.repeat(64)}`,
        logIndex: 4n,
      },
    ];

    render(<Play />);

    expect(screen.queryByText('EXPEDITION COMPLETE')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Explore 3/ })).toBeInTheDocument();
  });

  it('offers Resume after reload and verifies the saved direct transaction before Reveal', async () => {
    const user = userEvent.setup();
    const purchaseHash = `0x${'a'.repeat(64)}`;
    localStorage.setItem(
      'megaplanets:expedition:v1:84532:0x0000000000000000000000000000000000000001',
      JSON.stringify({
        version: 1,
        account: '0x0000000000000000000000000000000000000001',
        chainId: 84532,
        purchaseMode: 'direct',
        drawingId: '218',
        quantity: 1,
        automaticQuickPick: true,
        coordinates: [],
        purchaseTxHash: purchaseHash,
        bulkOrderReference: null,
        createdAt: 123,
      }),
    );
    mocks.eligibleTickets = [
      {
        ticketId: 34n,
        drawingId: 218n,
        normals: [1, 2, 3, 4, 5],
        bonusBall: 1,
        originTxHash: purchaseHash,
        logIndex: 0n,
      },
    ];
    render(<Play />);

    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(mocks.buy).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'You found 1 planet!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'REVEAL (1)' })).toBeInTheDocument();
  });

  it('uses only exact bulk execution tickets instead of older same-drawing recovery history', async () => {
    const user = userEvent.setup();
    const executionHash = `0x${'c'.repeat(64)}`;
    localStorage.setItem(
      'megaplanets:expedition:v1:84532:0x0000000000000000000000000000000000000001',
      JSON.stringify({
        version: 1,
        account: '0x0000000000000000000000000000000000000001',
        chainId: 84532,
        purchaseMode: 'bulk',
        drawingId: '218',
        quantity: 14,
        automaticQuickPick: true,
        coordinates: [],
        purchaseTxHash: executionHash,
        bulkOrderReference: executionHash,
        createdAt: 123,
      }),
    );
    mocks.bulkTickets = Array.from({ length: 14 }, (_, index) => ({
      ticketId: BigInt(90 + index),
      drawingId: 218n,
      normals: [1, 2, 3, 4, 5],
      bonusBall: 1,
      originTxHash: executionHash,
      logIndex: BigInt(index),
    }));
    mocks.eligibleTickets = [
      {
        ticketId: 12n,
        drawingId: 218n,
        normals: [1, 2, 3, 4, 5],
        bonusBall: 1,
        originTxHash: `0x${'1'.repeat(64)}`,
        logIndex: 0n,
      },
    ];
    render(<Play />);

    await user.click(await screen.findByRole('button', { name: 'Resume' }));

    expect(screen.getByRole('heading', { name: 'You found 14 planets!' })).toBeInTheDocument();
    expect(screen.queryByText('Planet artwork 12')).not.toBeInTheDocument();
  });

  it('re-submits a direct purchase when Resume restores an unsigned session', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'megaplanets:expedition:v1:84532:0x0000000000000000000000000000000000000001',
      JSON.stringify({
        version: 1,
        account: '0x0000000000000000000000000000000000000001',
        chainId: 84532,
        purchaseMode: 'direct',
        drawingId: '218',
        quantity: 1,
        automaticQuickPick: true,
        coordinates: [],
        purchaseTxHash: null,
        bulkOrderReference: null,
        createdAt: 123,
      }),
    );
    render(<Play />);

    await user.click(await screen.findByRole('button', { name: 'Resume' }));

    expect(mocks.buy).toHaveBeenCalledWith({
      count: 1,
      bounds: { ballMax: 50, bonusballMax: 10 },
      customTickets: [],
    });
  });

  it('restarts a bulk purchase when Resume restores an unsigned session', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'megaplanets:expedition:v1:84532:0x0000000000000000000000000000000000000001',
      JSON.stringify({
        version: 1,
        account: '0x0000000000000000000000000000000000000001',
        chainId: 84532,
        purchaseMode: 'bulk',
        drawingId: '218',
        quantity: 14,
        automaticQuickPick: true,
        coordinates: [],
        purchaseTxHash: null,
        bulkOrderReference: null,
        createdAt: 123,
      }),
    );
    render(<Play />);

    await user.click(await screen.findByRole('button', { name: 'Resume' }));

    expect(mocks.bulkCreateOrder).toHaveBeenCalledTimes(1);
  });

  it('does not carry a completed reveal into a different wallet or network', async () => {
    const user = userEvent.setup();
    mocks.directTickets = [
      {
        ticketId: 34n,
        drawingId: 218n,
        normals: [1, 2, 3, 4, 5],
        bonusBall: 1,
        originTxHash: '0x1234',
        logIndex: 0n,
      },
    ];
    const view = render(<Play />);

    await user.click(screen.getByRole('button', { name: 'Custom quantity' }));
    await user.type(screen.getByLabelText('Custom planet count'), '1{enter}');
    await user.click(screen.getByRole('button', { name: /^Explore 1/ }));
    await user.click(screen.getByText('Complete reveal'));
    expect(
      screen.getByRole('heading', { name: 'Your new planets are ready.' }),
    ).toBeInTheDocument();

    mocks.account = {
      address: '0x0000000000000000000000000000000000000002',
      isConnected: true,
    };
    mocks.chainId = 84533;
    view.rerender(<Play />);

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Your new planets are ready.' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Explore 1/ })).toBeInTheDocument();
    });
  });
});
