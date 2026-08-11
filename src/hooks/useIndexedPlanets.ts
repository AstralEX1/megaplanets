import { useQuery } from '@tanstack/react-query';
import { getAddress } from 'viem';
import { QK } from '@/lib/api';

export type IndexedPlanet = {
  tokenId: string;
  ticketId: string | null;
  ownerAddress: `0x${string}`;
  kind: 'NORMAL' | 'SPECIAL';
  seed: `0x${string}` | null;
  traitsHash: `0x${string}` | null;
  metadataUri: string;
  baseMineralsPerDay: string | null;
  generatorVersion: number | null;
  planetType: string | null;
  terrain: string | null;
  rarity: string | null;
  satelliteCount: number | null;
  hasRing: boolean | null;
  mintTxHash: `0x${string}`;
  mintedAt: string;
  ticket: {
    drawingId: string;
    normals: number[];
    bonusBall: number;
    originTxHash: `0x${string}`;
  } | null;
};

type IndexedPlanetsResponse = { planets: IndexedPlanet[] };

async function fetchIndexedPlanets(owner: `0x${string}`): Promise<IndexedPlanet[]> {
  const response = await fetch(`/api/planets?owner=${encodeURIComponent(getAddress(owner))}`);
  if (!response.ok) throw new Error(`Planet index returned HTTP ${response.status}.`);
  const payload = (await response.json()) as IndexedPlanetsResponse;
  return payload.planets;
}

/** Reads canonical minted ownership from the Stage 2 backend index. */
export function useIndexedPlanets(owner: `0x${string}` | undefined) {
  const query = useQuery({
    queryKey: [QK.NS, 'indexed-planets', owner],
    queryFn: () => {
      if (!owner) throw new Error('A connected wallet is required.');
      return fetchIndexedPlanets(owner);
    },
    enabled: !!owner,
    staleTime: 30_000,
  });
  return { planets: query.data ?? [], ...query };
}
