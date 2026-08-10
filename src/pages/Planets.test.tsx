// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('wagmi', () => ({ useAccount: () => ({ address: '0x0000000000000000000000000000000000000001', isConnected: true }) }));
vi.mock('@megaplanets/planet-generator', () => ({
  derivePlanetPreview: () => ({ descriptor: { input: { ticketId: 24n, drawingId: 218n, normals: [4, 11, 17, 26, 39], bonusBall: 66 }, traits: { name: 'Kepler', type: 'Gaia', rarity: 'Epic', minerals: 24, satelliteCount: 1, hasRing: false }, seed: '0x1234', traitsHash: '0x5678' }, visual: { input: { ticketId: 24n } } }),
}));
vi.mock('@/config/planetSeason', () => ({ PLANET_SEASON: { seasonId: '0x01' } }));
vi.mock('@/hooks/useEligiblePlanetTickets', () => ({ useEligiblePlanetTickets: () => ({ tickets: [{ ticketId: 24n, drawingId: 218n, normals: [4, 11, 17, 26, 39], bonusBall: 66, originTxHash: '0x1234', logIndex: 0n }], isLoading: false }) }));
vi.mock('@/hooks/useIndexedPlanets', () => ({ useIndexedPlanets: () => ({ planets: [{ tokenId: '24', ticketId: '24', ticket: { drawingId: '218', normals: [4, 11, 17, 26, 39], bonusBall: 66, originTxHash: '0x1234' } }], isLoading: false }) }));
vi.mock('@/hooks/usePlanetDrawingStates', () => ({ drawingStatusLabel: (status: string | undefined) => status === 'settled' ? 'DRAWING SETTLED' : status === 'active' ? 'DRAWING ACTIVE' : 'DRAWING STATUS UNAVAILABLE', usePlanetDrawingStates: () => ({ states: new Map([['218', 'settled']]), isLoading: false }) }));
vi.mock('@/lib/purchaseReceipt', () => ({ PURCHASED_TICKETS_UPDATED_EVENT: 'tickets-updated', readPersistedPurchasedTickets: () => ({ tickets: [], invalidKeys: [] }) }));
vi.mock('@/components/planets/PlanetThumbnail', () => ({ PlanetThumbnail: () => <span>Pixel preview</span> }));

import { Planets } from './Planets';

describe('Planets', () => {
  afterEach(cleanup);

  it('renders the selected revealed NFT with the drawing state from its linked ticket', () => {
    render(<Planets onNavigate={vi.fn()} />);

    expect(screen.getAllByText('Kepler')).toHaveLength(2);
    expect(screen.getAllByText('24 minerals/day')).toHaveLength(2);
    expect(screen.getAllByText('DRAWING SETTLED').length).toBeGreaterThan(0);
  });
});
