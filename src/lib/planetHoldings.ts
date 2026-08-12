import { type Address, getAddress } from 'viem';

/** Minimal read surface used by the direct Planet ownership reader. */
export type PlanetHoldingsClient = {
  getBlockNumber: (args?: {
    blockTag?: 'latest' | 'earliest' | 'pending' | 'safe' | 'finalized';
  }) => Promise<bigint>;
  readContract: (args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }) => Promise<unknown>;
  multicall: (args: {
    contracts: readonly PlanetCall[];
    allowFailure: boolean;
    blockNumber?: bigint;
  }) => Promise<readonly PlanetCallResult[]>;
  getLogs?: (args: {
    address: Address;
    event: typeof TRANSFER_EVENT;
    fromBlock: bigint;
    toBlock: bigint;
  }) => Promise<readonly PlanetTransferLog[]>;
};

export type PlanetCall = {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
};

export type PlanetCallResult =
  | { status: 'success'; result: unknown }
  | { status: 'failure'; error?: unknown };

export type PlanetTransferLog = {
  args?: { from?: Address; to?: Address; tokenId?: bigint };
  blockNumber?: bigint | null;
  logIndex?: number | bigint | null;
};

export type DirectPlanetHolding = {
  tokenId: string;
  ticketId: string | null;
  ownerAddress: Address;
  metadataUri: string;
};

export type PlanetHoldingsCacheEntry = {
  blockNumber: bigint;
  totalSupply: bigint;
  holdings: readonly DirectPlanetHolding[];
};

export type PlanetHoldingsCache = {
  entries: Map<string, PlanetHoldingsCacheEntry>;
};

export function createPlanetHoldingsCache(): PlanetHoldingsCache {
  return { entries: new Map() };
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
const DEFAULT_INITIAL_CHUNK_SIZE = 256;
const MAX_INCREMENTAL_BLOCK_SPAN = 50_000n;

export const TRANSFER_EVENT = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: true, name: 'tokenId', type: 'uint256' },
  ],
} as const;

const READ_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'ticketIdByPlanetTokenId',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export class PlanetHoldingsReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PlanetHoldingsReadError';
  }
}

type ReadOptions = {
  contractAddress: Address;
  owner: Address;
  cache?: PlanetHoldingsCache;
  initialChunkSize?: number;
  maxIncrementalBlockSpan?: bigint;
};

function cacheKey(contractAddress: Address, owner: Address) {
  return `${getAddress(contractAddress).toLowerCase()}:${getAddress(owner).toLowerCase()}`;
}

function asBigInt(value: unknown, label: string): bigint {
  try {
    const result = BigInt(value as bigint | string | number);
    if (result < 0n) throw new Error(`${label} was negative.`);
    return result;
  } catch (error) {
    throw new PlanetHoldingsReadError(`Planet ${label} could not be read.`, { cause: error });
  }
}

function asAddress(value: unknown, label: string): Address {
  if (typeof value !== 'string')
    throw new PlanetHoldingsReadError(`Planet ${label} was not an address.`);
  try {
    return getAddress(value);
  } catch (error) {
    throw new PlanetHoldingsReadError(`Planet ${label} was not a valid address.`, { cause: error });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isExpectedMissingToken(error: unknown) {
  return /nonexistent|does not exist|invalid token|token.*not found|erc721/i.test(
    errorMessage(error),
  );
}

async function readAtBlock(
  client: PlanetHoldingsClient,
  address: Address,
  functionName: 'balanceOf' | 'totalSupply',
  args: readonly unknown[],
  blockNumber: bigint,
) {
  try {
    return await client.readContract({
      address,
      abi: READ_ABI,
      functionName,
      args,
      blockNumber,
    });
  } catch (error) {
    throw new PlanetHoldingsReadError(`Planet ${functionName} RPC read failed.`, { cause: error });
  }
}

async function readFinalizedBlock(client: PlanetHoldingsClient): Promise<bigint> {
  try {
    return asBigInt(await client.getBlockNumber({ blockTag: 'finalized' }), 'finalized block');
  } catch (firstError) {
    // Some development RPCs do not implement the finalized tag. Retrying the
    // ordinary block-number call keeps the read usable while still surfacing a
    // complete failure instead of returning a false empty wallet.
    try {
      return asBigInt(await client.getBlockNumber(), 'block');
    } catch (error) {
      throw new PlanetHoldingsReadError('Planet finalized block could not be read.', {
        cause: error ?? firstError,
      });
    }
  }
}

function makeCalls(
  contractAddress: Address,
  functionName: string,
  tokenIds: readonly bigint[],
): PlanetCall[] {
  return tokenIds.map((tokenId) => ({
    address: contractAddress,
    abi: READ_ABI,
    functionName,
    args: [tokenId],
  }));
}

async function adaptiveMulticall(
  client: PlanetHoldingsClient,
  calls: readonly PlanetCall[],
  blockNumber: bigint,
  initialChunkSize: number,
): Promise<PlanetCallResult[]> {
  if (calls.length === 0) return [];
  let chunkSize = Math.max(1, Math.floor(initialChunkSize));
  const results: PlanetCallResult[] = [];
  let offset = 0;
  while (offset < calls.length) {
    const chunk = calls.slice(offset, offset + chunkSize);
    try {
      const response = await client.multicall({
        contracts: chunk,
        allowFailure: true,
        blockNumber,
      });
      if (response.length !== chunk.length) {
        throw new PlanetHoldingsReadError(
          'Planet ownerOf multicall returned an incomplete response.',
        );
      }
      results.push(...response);
      offset += chunk.length;
    } catch (error) {
      if (chunkSize <= 1) {
        throw new PlanetHoldingsReadError('Planet multicall RPC failed.', { cause: error });
      }
      chunkSize = Math.max(1, Math.floor(chunkSize / 2));
    }
  }
  return results;
}

async function scanOwnedTokenIds(
  client: PlanetHoldingsClient,
  contractAddress: Address,
  owner: Address,
  totalSupply: bigint,
  balance: bigint,
  blockNumber: bigint,
  initialChunkSize: number,
): Promise<bigint[]> {
  const owned: bigint[] = [];
  let start = 1n;
  let chunkSize = Math.max(1, Math.floor(initialChunkSize));
  while (start <= totalSupply) {
    const end =
      start + BigInt(chunkSize) - 1n > totalSupply ? totalSupply : start + BigInt(chunkSize) - 1n;
    const tokenIds = Array.from(
      { length: Number(end - start + 1n) },
      (_, index) => start + BigInt(index),
    );
    const results = await adaptiveMulticall(
      client,
      makeCalls(contractAddress, 'ownerOf', tokenIds),
      blockNumber,
      chunkSize,
    );
    for (const [index, result] of results.entries()) {
      if (result.status === 'success') {
        const tokenOwner = asAddress(result.result, `ownerOf(${tokenIds[index]})`);
        if (tokenOwner.toLowerCase() === owner.toLowerCase()) owned.push(tokenIds[index]);
      } else if (!isExpectedMissingToken(result.error)) {
        throw new PlanetHoldingsReadError(`Planet ownerOf(${tokenIds[index]}) RPC read failed.`, {
          cause: result.error,
        });
      }
    }
    start = end + 1n;
    // A successful smaller chunk is retained for the remainder of this scan;
    // never skip IDs merely because balanceOf was reached early. The full
    // [1, totalSupply] ERC721A range must be checked to avoid false holdings.
    chunkSize = Math.max(1, Math.min(chunkSize, initialChunkSize));
  }
  if (BigInt(owned.length) !== balance) {
    throw new PlanetHoldingsReadError(
      `Planet owner scan found ${owned.length} token(s), but balanceOf returned ${balance}.`,
    );
  }
  return owned;
}

async function readOwnedDetails(
  client: PlanetHoldingsClient,
  contractAddress: Address,
  tokenIds: readonly bigint[],
  blockNumber: bigint,
  initialChunkSize: number,
): Promise<DirectPlanetHolding[]> {
  if (tokenIds.length === 0) return [];
  const calls = [
    ...makeCalls(contractAddress, 'tokenURI', tokenIds),
    ...makeCalls(contractAddress, 'ticketIdByPlanetTokenId', tokenIds),
  ];
  const results = await adaptiveMulticall(client, calls, blockNumber, initialChunkSize);
  const holdings: DirectPlanetHolding[] = [];
  for (let index = 0; index < tokenIds.length; index += 1) {
    const uriResult = results[index];
    const ticketResult = results[tokenIds.length + index];
    if (uriResult?.status !== 'success' || ticketResult?.status !== 'success') {
      throw new PlanetHoldingsReadError(
        `Planet metadata for token ${tokenIds[index]} could not be read.`,
        {
          cause:
            uriResult?.status === 'failure'
              ? uriResult.error
              : ticketResult?.status === 'failure'
                ? ticketResult.error
                : undefined,
        },
      );
    }
    if (typeof uriResult.result !== 'string') {
      throw new PlanetHoldingsReadError(`Planet tokenURI(${tokenIds[index]}) was not a string.`);
    }
    const ticketId = asBigInt(ticketResult.result, `ticketIdByPlanetTokenId(${tokenIds[index]})`);
    holdings.push({
      tokenId: tokenIds[index].toString(),
      ticketId: ticketId === 0n ? null : ticketId.toString(),
      ownerAddress: ZERO_ADDRESS,
      metadataUri: uriResult.result,
    });
  }
  return holdings;
}

function withOwner(holdings: readonly DirectPlanetHolding[], owner: Address) {
  return holdings.map((holding) => ({ ...holding, ownerAddress: getAddress(owner) }));
}

function sortHoldings(holdings: readonly DirectPlanetHolding[]) {
  return [...holdings].sort((left, right) => {
    const a = BigInt(left.tokenId);
    const b = BigInt(right.tokenId);
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

async function tryIncremental(
  client: PlanetHoldingsClient,
  contractAddress: Address,
  owner: Address,
  previous: PlanetHoldingsCacheEntry,
  balance: bigint,
  totalSupply: bigint,
  blockNumber: bigint,
  initialChunkSize: number,
  maxIncrementalBlockSpan: bigint,
): Promise<readonly DirectPlanetHolding[] | undefined> {
  if (
    !client.getLogs ||
    blockNumber <= previous.blockNumber ||
    blockNumber - previous.blockNumber > maxIncrementalBlockSpan
  )
    return undefined;
  let logs: readonly PlanetTransferLog[];
  try {
    logs = await client.getLogs({
      address: contractAddress,
      event: TRANSFER_EVENT,
      fromBlock: previous.blockNumber + 1n,
      toBlock: blockNumber,
    });
  } catch {
    return undefined;
  }

  const byToken = new Map(previous.holdings.map((holding) => [BigInt(holding.tokenId), holding]));
  const added = new Set<bigint>();
  const orderedLogs = [...logs].sort((left, right) => {
    const blockA = left.blockNumber ?? -1n;
    const blockB = right.blockNumber ?? -1n;
    if (blockA !== blockB) return blockA < blockB ? -1 : 1;
    const logA = BigInt(left.logIndex ?? -1);
    const logB = BigInt(right.logIndex ?? -1);
    return logA < logB ? -1 : logA > logB ? 1 : 0;
  });
  for (const log of orderedLogs) {
    if (
      log.blockNumber === null ||
      log.blockNumber === undefined ||
      log.logIndex === null ||
      log.logIndex === undefined
    )
      return undefined;
    const from = log.args?.from;
    const to = log.args?.to;
    const tokenId = log.args?.tokenId;
    if (!from || !to || tokenId === undefined) return undefined;
    const fromIsOwner = from.toLowerCase() === owner.toLowerCase();
    const toIsOwner = to.toLowerCase() === owner.toLowerCase();
    if (fromIsOwner) byToken.delete(tokenId);
    if (toIsOwner) {
      if (!byToken.has(tokenId)) added.add(tokenId);
      // A temporary placeholder lets count validation happen before metadata reads.
      byToken.set(tokenId, {
        tokenId: tokenId.toString(),
        ticketId: null,
        ownerAddress: getAddress(owner),
        metadataUri: '',
      });
    }
  }
  if (BigInt(byToken.size) !== balance || BigInt(byToken.size) > totalSupply) return undefined;
  const addedIds = [...added].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (addedIds.length > 0) {
    const details = withOwner(
      await readOwnedDetails(client, contractAddress, addedIds, blockNumber, initialChunkSize),
      owner,
    );
    for (const detail of details) byToken.set(BigInt(detail.tokenId), detail);
  }
  return sortHoldings([...byToken.values()]);
}

/**
 * Reads current Planet ownership directly from the configured ERC721A contract.
 * The complete sequential token range is scanned without a supply cap. RPC
 * errors reject the read, allowing the hook to distinguish an unavailable RPC
 * from a genuinely empty wallet.
 */
export async function readDirectPlanetHoldings(
  client: PlanetHoldingsClient,
  options: ReadOptions,
): Promise<readonly DirectPlanetHolding[]> {
  const contractAddress = getAddress(options.contractAddress);
  const owner = getAddress(options.owner);
  const initialChunkSize = Math.max(
    1,
    Math.floor(options.initialChunkSize ?? DEFAULT_INITIAL_CHUNK_SIZE),
  );
  const blockNumber = await readFinalizedBlock(client);
  const balance = asBigInt(
    await readAtBlock(client, contractAddress, 'balanceOf', [owner], blockNumber),
    'balanceOf',
  );
  const key = cacheKey(contractAddress, owner);
  const cached = options.cache?.entries.get(key);
  if (cached?.blockNumber === blockNumber) return cached.holdings;
  if (balance === 0n) {
    const empty = [] as const;
    options.cache?.entries.set(key, {
      blockNumber,
      totalSupply: cached?.totalSupply ?? 0n,
      holdings: empty,
    });
    return empty;
  }

  const totalSupply = asBigInt(
    await readAtBlock(client, contractAddress, 'totalSupply', [], blockNumber),
    'totalSupply',
  );
  if (totalSupply === 0n || balance > totalSupply) {
    throw new PlanetHoldingsReadError(
      `Planet supply ${totalSupply} cannot contain balance ${balance}.`,
    );
  }

  if (cached) {
    const incremental = await tryIncremental(
      client,
      contractAddress,
      owner,
      cached,
      balance,
      totalSupply,
      blockNumber,
      initialChunkSize,
      options.maxIncrementalBlockSpan ?? MAX_INCREMENTAL_BLOCK_SPAN,
    );
    if (incremental !== undefined) {
      options.cache?.entries.set(key, { blockNumber, totalSupply, holdings: incremental });
      return incremental;
    }
  }

  const ownedTokenIds = await scanOwnedTokenIds(
    client,
    contractAddress,
    owner,
    totalSupply,
    balance,
    blockNumber,
    initialChunkSize,
  );
  const holdings = withOwner(
    await readOwnedDetails(client, contractAddress, ownedTokenIds, blockNumber, initialChunkSize),
    owner,
  );
  const sorted = sortHoldings(holdings);
  options.cache?.entries.set(key, { blockNumber, totalSupply, holdings: sorted });
  return sorted;
}
