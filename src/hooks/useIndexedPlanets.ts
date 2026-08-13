import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { type Address, getAddress } from 'viem';
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
import { invalidatePostWriteQueries } from '@/lib/queryInvalidation';

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

type IndexedPlanetResponse = { planet?: IndexedPlanet };

const planetTokenIdByTicketIdAbi = [
  {
    type: 'function',
    name: 'planetTokenIdByTicketId',
    stateMutability: 'view',
    inputs: [{ name: 'ticketId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

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

/**
 * Enriches direct ERC721A holdings with immutable projector provenance keyed by
 * Planet token ID. The direct row remains authoritative for current ownership;
 * the API is only a provenance adapter and may be temporarily unavailable.
 */
export async function hydrateDirectPlanetProvenance(
  holdings: readonly Awaited<ReturnType<typeof readDirectPlanetHoldings>>[number][],
): Promise<IndexedPlanet[]> {
  return Promise.all(
    holdings.map(async (holding) => {
      const direct = directPlanetToIndexed(holding);
      try {
        const response = await backendApiFetch(
          `/api/planets/${encodeURIComponent(holding.tokenId)}`,
        );
        if (!response.ok) return direct;
        const payload = (await response.json()) as IndexedPlanetResponse;
        const indexed = payload.planet;
        if (!indexed || indexed.tokenId !== holding.tokenId) return direct;
        return {
          ...indexed,
          tokenId: holding.tokenId,
          ticketId: holding.ticketId ?? indexed.ticketId,
          ownerAddress: holding.ownerAddress,
          metadataUri: indexed.metadataUri || holding.metadataUri,
        };
      } catch {
        return direct;
      }
    }),
  );
}

/** Reads immutable ticket → Planet mappings; a non-zero token ID means minted. */
export async function readMintedPlanetTicketIds(
  client: Pick<PlanetHoldingsClient, 'readContract'>,
  contractAddress: Address,
  ticketIds: readonly string[],
): Promise<readonly string[]> {
  const uniqueTicketIds = [...new Set(ticketIds)].filter((ticketId) => /^\d+$/.test(ticketId));
  if (uniqueTicketIds.length === 0) return [];
  const tokenIds = await Promise.all(
    uniqueTicketIds.map((ticketId) =>
      client.readContract({
        address: contractAddress,
        abi: planetTokenIdByTicketIdAbi,
        functionName: 'planetTokenIdByTicketId',
        args: [BigInt(ticketId)],
      }),
    ),
  );
  return uniqueTicketIds.filter((_, index) => BigInt(tokenIds[index] as bigint) !== 0n);
}

const directQueryKey = [QK.NS, 'direct-planet-holdings'] as const;

export type UseIndexedPlanetsOptions = {
  /** Candidate tickets whose immutable mint mapping must be checked before reveal. */
  ticketIds?: readonly string[];
};

/** Reads current ownership from chain by default; the backend is explicit rollback mode. */
export function useIndexedPlanets(
  owner: `0x${string}` | undefined,
  options: UseIndexedPlanetsOptions = {},
) {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const cacheRef = useRef(createPlanetHoldingsCache());
  const source: PlanetHoldingsSource = PLANET_HOLDINGS_SOURCE;
  const direct = source !== 'indexed';
  const ticketIds = useMemo(
    () => [...new Set(options.ticketIds ?? [])].filter((ticketId) => /^\d+$/.test(ticketId)).sort(),
    [options.ticketIds],
  );
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
      }).then((planets) => hydrateDirectPlanetProvenance(planets));
    },
    enabled: !!owner,
    staleTime: direct ? 15_000 : 30_000,
    refetchInterval: direct ? 15_000 : 30_000,
  });

  const provenanceQuery = useQuery({
    queryKey: [
      ...directQueryKey,
      'minted-ticket-provenance',
      MEGAPLANETS_CONTRACT_ADDRESS,
      ticketIds,
    ],
    queryFn: () => {
      if (!publicClient || !MEGAPLANETS_CONTRACT_ADDRESS) {
        throw new Error(
          'A public RPC client and Planet contract are required for mint provenance.',
        );
      }
      return readMintedPlanetTicketIds(
        publicClient as unknown as Pick<PlanetHoldingsClient, 'readContract'>,
        MEGAPLANETS_CONTRACT_ADDRESS,
        ticketIds,
      );
    },
    enabled:
      direct && !!owner && !!publicClient && !!MEGAPLANETS_CONTRACT_ADDRESS && ticketIds.length > 0,
    staleTime: 15_000,
    refetchInterval: direct ? 15_000 : false,
  });
  const mintedTicketIds = useMemo(
    () => new Set(provenanceQuery.data ?? []),
    [provenanceQuery.data],
  );

  useWatchContractEvent({
    address: direct ? MEGAPLANETS_CONTRACT_ADDRESS : undefined,
    abi: [TRANSFER_EVENT],
    eventName: 'Transfer',
    onLogs: () => {
      // Transfers and burns change both authoritative holdings and the
      // backend current-owner mining aggregate. The projector remains
      // finalized, so the refreshed mining result may explicitly lag RPC.
      void invalidatePostWriteQueries(queryClient);
    },
    poll: true,
  });

  return {
    ...query,
    planets: query.data ?? [],
    source,
    isDirect: direct,
    mintedTicketIds,
    provenanceLoading: provenanceQuery.isLoading,
    provenanceError: provenanceQuery.error,
    isLoading: query.isLoading || provenanceQuery.isLoading,
  };
}
