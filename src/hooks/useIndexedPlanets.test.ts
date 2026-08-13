import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DirectPlanetHolding } from '@/lib/planetHoldings';

const backendApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/backendApi', () => ({
  BACKEND_API_BASE_URL: '',
  backendApiFetch,
}));

import { hydrateDirectPlanetProvenance, readMintedPlanetTicketIds } from './useIndexedPlanets';

const OWNER = '0x0000000000000000000000000000000000000002' as `0x${string}`;
const INDEXER_OWNER = '0x0000000000000000000000000000000000000003' as `0x${string}`;
const TX_HASH = `0x${'a'.repeat(64)}` as `0x${string}`;

function directHolding(): DirectPlanetHolding {
  return {
    tokenId: '7',
    ticketId: '24',
    ownerAddress: OWNER,
    metadataUri: 'ipfs://planet-7',
  };
}

describe('hydrateDirectPlanetProvenance', () => {
  afterEach(() => backendApiFetch.mockReset());

  it('hydrates immutable ticket provenance by held token ID while preserving direct ownership', async () => {
    backendApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          planet: {
            tokenId: '7',
            ticketId: '24',
            ownerAddress: INDEXER_OWNER,
            kind: 'NORMAL',
            seed: `0x${'b'.repeat(64)}`,
            traitsHash: `0x${'c'.repeat(64)}`,
            metadataUri: 'ipfs://planet-7',
            baseMineralsPerDay: '24',
            generatorVersion: 3,
            planetType: 'Gaia',
            terrain: 'pixel-continents',
            rarity: 'Epic',
            satelliteCount: 1,
            hasRing: false,
            mintTxHash: TX_HASH,
            mintedAt: '2026-08-01T00:00:00.000Z',
            ticket: {
              drawingId: '218',
              normals: [4, 11, 17, 26, 39],
              bonusBall: 66,
              originTxHash: TX_HASH,
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const [planet] = await hydrateDirectPlanetProvenance([directHolding()]);

    expect(backendApiFetch).toHaveBeenCalledWith('/api/planets/7');
    expect(planet).toMatchObject({
      tokenId: '7',
      ticketId: '24',
      ownerAddress: OWNER,
      ticket: {
        drawingId: '218',
        normals: [4, 11, 17, 26, 39],
        bonusBall: 66,
        originTxHash: TX_HASH,
      },
    });
  });

  it('keeps the direct holding when token provenance is temporarily unavailable', async () => {
    backendApiFetch.mockRejectedValue(new Error('index offline'));

    const [planet] = await hydrateDirectPlanetProvenance([directHolding()]);

    expect(planet).toMatchObject({
      tokenId: '7',
      ticketId: '24',
      ownerAddress: OWNER,
      ticket: null,
    });
  });
});

describe('readMintedPlanetTicketIds', () => {
  it('treats a non-zero immutable token mapping as already minted', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(11n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(12n);

    await expect(
      readMintedPlanetTicketIds(
        { readContract } as never,
        '0x0000000000000000000000000000000000000004',
        ['24', '25', '24', '26'],
      ),
    ).resolves.toEqual(['24', '26']);
    expect(readContract).toHaveBeenCalledTimes(3);
  });
});
