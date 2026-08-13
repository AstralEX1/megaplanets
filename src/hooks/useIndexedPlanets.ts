import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { getAddress } from 'viem';
import { usePublicClient, useWatchContractEvent } from 'wagmi';
import { MEGAPLANETS_CONTRACT_ADDRESS } from '@/config/contracts';
import { PLANET_HOLDINGS_SOURCE, type PlanetHoldingsSource } from '@/config/planetConfig';
import { QK } from '@/lib/api';
import { BACKEND_API_BASE_URL, backendApiFetch } from '@/lib/backendApi';
import {
  createPlanetHoldingsCache,
  type PlanetHoldingsClient,
  readDirectPlanetHoldings,
  TRANSFER_EVENT,
} from '@/lib/planetHoldings';

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
  mintTxHash?: `0x${string}`;
  mintedAt?: string;
  ticket: {
    drawingId: string;
    normals: number[];
    bonusBall: number;
    originTxHash: `0x${string}`;
  } | null;
};

type IndexedPlanetsResponse = { planets: IndexedPlanet[] };

async function fetchIndexedPlanets(owner: `0x${string}`): Promise<IndexedPlanet[]> {
  const response = await backendApiFetch(
    `/api/planets?owner=${encodeURIComponent(getAddress(owner))}`,
  );
  if (!response.ok) throw new Error(`Planet index returned HTTP ${response.status}.`);
  const payload = (await response.json()) as IndexedPlanetsResponse;
  return payload.planets;
}

function directPlanetToIndexed(
  planet: Awaited<ReturnType<typeof readDirectPlanetHoldings>>[number],
): IndexedPlanet {
  return {
    tokenId: planet.tokenId,
    ticketId: planet.ticketId,
    ownerAddress: planet.ownerAddress,
    kind: 'NORMAL',
    seed: null,
    traitsHash: null,
    metadataUri: planet.metadataUri,
    baseMineralsPerDay: null,
    generatorVersion: null,
    planetType: null,
    terrain: null,
    rarity: null,
    satelliteCount: null,
    hasRing: null,
    ticket: null,
  };
}

const directQueryKey = [QK.NS, 'direct-planet-holdings'] as const;

/** Reads current ownership from chain by default; the backend is explicit rollback mode. */
export function useIndexedPlanets(owner: `0x${string}` | undefined) {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const cacheRef = useRef(createPlanetHoldingsCache());
  const source: PlanetHoldingsSource = PLANET_HOLDINGS_SOURCE;
  const direct = source !== 'indexed';
  const query = useQuery({
    queryKey: direct
      ? [...directQueryKey, MEGAPLANETS_CONTRACT_ADDRESS, owner]
      : [QK.NS, BACKEND_API_BASE_URL, 'indexed-planets', owner],
    queryFn: () => {
      if (!owner) throw new Error('A connected wallet is required.');
      if (!direct) return fetchIndexedPlanets(owner);
      if (!publicClient)
        throw new Error('A public RPC client is required for direct Planet ownership.');
      if (!MEGAPLANETS_CONTRACT_ADDRESS) {
        throw new Error(
          'VITE_MEGAPLANETS_CONTRACT_ADDRESS is required for direct Planet ownership.',
        );
      }
      return readDirectPlanetHoldings(publicClient as unknown as PlanetHoldingsClient, {
        contractAddress: MEGAPLANETS_CONTRACT_ADDRESS,
        owner,
        cache: cacheRef.current,
      }).then((planets) => planets.map(directPlanetToIndexed));
    },
    enabled: !!owner,
    staleTime: direct ? 15_000 : 30_000,
    refetchInterval: direct ? 15_000 : 30_000,
  });

  useWatchContractEvent({
    address: direct ? MEGAPLANETS_CONTRACT_ADDRESS : undefined,
    abi: [TRANSFER_EVENT],
    eventName: 'Transfer',
    onLogs: () => {
      void queryClient.invalidateQueries({ queryKey: [...directQueryKey] });
    },
    poll: true,
  });

  return {
    planets: query.data ?? [],
    source,
    isDirect: direct,
    ...query,
  };
}
