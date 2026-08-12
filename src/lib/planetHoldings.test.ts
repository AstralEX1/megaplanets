import { type Address, getAddress } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import {
  createPlanetHoldingsCache,
  type PlanetHoldingsClient,
  readDirectPlanetHoldings,
} from './planetHoldings';

const CONTRACT = '0x0000000000000000000000000000000000000009' as Address;
const OWNER = '0x0000000000000000000000000000000000000001' as Address;
const OTHER = '0x0000000000000000000000000000000000000002' as Address;

function success<T>(result: T) {
  return { status: 'success' as const, result };
}

function clientWith({
  balance = 0n,
  supply = 0n,
  blockNumber = 100n,
  ownerIds = new Set<bigint>(),
  metadata = new Map<bigint, string>(),
  ticketIds = new Map<bigint, bigint>(),
  onMulticall,
  getLogs,
}: {
  balance?: bigint;
  supply?: bigint;
  blockNumber?: bigint;
  ownerIds?: ReadonlySet<bigint>;
  metadata?: ReadonlyMap<bigint, string>;
  ticketIds?: ReadonlyMap<bigint, bigint>;
  onMulticall?: PlanetHoldingsClient['multicall'];
  getLogs?: PlanetHoldingsClient['getLogs'];
} = {}): PlanetHoldingsClient {
  return {
    getBlockNumber: vi.fn(async () => blockNumber),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'balanceOf') return balance;
      if (functionName === 'totalSupply') return supply;
      throw new Error(`Unexpected readContract call ${functionName}`);
    }),
    multicall:
      onMulticall ??
      (vi.fn(
        async ({
          contracts,
        }: {
          contracts: readonly { functionName: string; args: readonly [bigint] }[];
        }) =>
          contracts.map(({ functionName, args }) => {
            const tokenId = args[0];
            if (functionName === 'ownerOf') {
              return ownerIds.has(tokenId)
                ? success(OWNER)
                : { status: 'failure' as const, error: new Error('ERC721: invalid token ID') };
            }
            if (functionName === 'tokenURI')
              return success(metadata.get(tokenId) ?? `ipfs://planet-${tokenId}`);
            if (functionName === 'ticketIdByPlanetTokenId')
              return success(ticketIds.get(tokenId) ?? tokenId + 1000n);
            throw new Error(`Unexpected multicall function ${functionName}`);
          }),
      ) as unknown as PlanetHoldingsClient['multicall']),
    getLogs: getLogs ?? vi.fn(async () => []),
  };
}

describe('readDirectPlanetHoldings', () => {
  it('returns an authoritative empty result from balanceOf without probing supply', async () => {
    const client = clientWith({ balance: 0n, supply: 10_000n });

    await expect(
      readDirectPlanetHoldings(client, { contractAddress: CONTRACT, owner: OWNER }),
    ).resolves.toEqual([]);

    expect(client.readContract).toHaveBeenCalledTimes(1);
    expect(client.multicall).not.toHaveBeenCalled();
  });

  it('adapts failed ownerOf chunks and scans the complete unbounded supply', async () => {
    const ownerIds = new Set([2n, 1_199n, 1_205n]);
    const calls: number[] = [];
    const client = clientWith({
      balance: 3n,
      supply: 1_205n,
      ownerIds,
      onMulticall: vi.fn(
        async ({
          contracts,
        }: {
          contracts: readonly { functionName: string; args: readonly [bigint] }[];
        }) => {
          const ids = contracts.map((contract) => contract.args[0]);
          if (ids.some((id) => id > 2n) && ids.length > 8) throw new Error('RPC request too large');
          calls.push(ids.length);
          return ids.map((tokenId) =>
            ownerIds.has(tokenId)
              ? success(OWNER)
              : { status: 'failure' as const, error: new Error('ERC721: invalid token ID') },
          );
        },
      ) as unknown as PlanetHoldingsClient['multicall'],
    });

    const holdings = await readDirectPlanetHoldings(client, {
      contractAddress: CONTRACT,
      owner: OWNER,
      initialChunkSize: 32,
    });

    expect(holdings.map((planet) => planet.tokenId)).toEqual(['2', '1199', '1205']);
    expect(Math.max(...calls)).toBeLessThanOrEqual(8);
    expect(holdings.every((planet) => planet.ticketId !== null)).toBe(true);
  });

  it('reads metadata and ticket mappings only for owned token IDs', async () => {
    const client = clientWith({ balance: 1n, supply: 5n, ownerIds: new Set([4n]) });

    await readDirectPlanetHoldings(client, { contractAddress: CONTRACT, owner: OWNER });

    const calls = vi.mocked(client.multicall).mock.calls;
    const detailCalls = calls
      .flatMap(([request]) => request.contracts)
      .filter(({ functionName }) => functionName !== 'ownerOf');
    expect(detailCalls).toHaveLength(2);
    expect(detailCalls.every(({ args }) => args?.[0] === 4n)).toBe(true);
  });

  it('does not turn partial RPC failures into a false empty wallet', async () => {
    const client = clientWith({
      balance: 1n,
      supply: 1n,
      onMulticall: vi.fn(async () => [
        { status: 'failure' as const, error: new Error('upstream RPC unavailable') },
      ]) as unknown as PlanetHoldingsClient['multicall'],
    });

    await expect(
      readDirectPlanetHoldings(client, { contractAddress: CONTRACT, owner: OWNER }),
    ).rejects.toThrow(/RPC|ownerOf|failed/i);
  });

  it('keys the cache by finalized block and applies safe Transfer changes incrementally', async () => {
    let blockNumber = 100n;
    const client = clientWith({
      balance: 1n,
      supply: 2n,
      ownerIds: new Set([1n]),
      getLogs: vi.fn(async () => [
        {
          args: { from: OWNER, to: OTHER, tokenId: 1n },
          blockNumber: 101n,
          logIndex: 0,
        },
        {
          args: { from: OTHER, to: OWNER, tokenId: 2n },
          blockNumber: 101n,
          logIndex: 1,
        },
      ]),
    });
    vi.mocked(client.getBlockNumber).mockImplementation(async () => blockNumber);
    vi.mocked(client.readContract).mockImplementation(
      async ({ functionName }: { functionName: string }) => {
        if (functionName === 'balanceOf') return 1n;
        if (functionName === 'totalSupply') return 2n;
        throw new Error(`Unexpected readContract call ${functionName}`);
      },
    );

    const cache = createPlanetHoldingsCache();
    const first = await readDirectPlanetHoldings(client, {
      contractAddress: CONTRACT,
      owner: OWNER,
      cache,
    });
    const firstMulticallCount = vi.mocked(client.multicall).mock.calls.length;
    const sameBlock = await readDirectPlanetHoldings(client, {
      contractAddress: CONTRACT,
      owner: OWNER,
      cache,
    });
    expect(sameBlock).toEqual(first);
    expect(vi.mocked(client.multicall).mock.calls.length).toBe(firstMulticallCount);

    blockNumber = 101n;
    const changed = await readDirectPlanetHoldings(client, {
      contractAddress: CONTRACT,
      owner: OWNER,
      cache,
    });
    expect(changed.map((planet) => planet.tokenId)).toEqual(['2']);
    expect(getAddress(changed[0]?.ownerAddress as Address)).toBe(getAddress(OWNER));
  });
});
