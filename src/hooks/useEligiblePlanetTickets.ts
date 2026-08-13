import { useQuery } from '@tanstack/react-query';
import {
  type Address,
  createPublicClient,
  getAddress,
  http,
  isHash,
  type PublicClient,
  parseAbiItem,
  type TransactionReceipt,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { usePublicClient } from 'wagmi';
import {
  CHAIN,
  JACKPOT_ADDRESS,
  MEGAPLANETS_LAUNCH_BLOCK,
  MEGAPLANETS_TICKET_START_BLOCK,
  TICKET_SOURCE,
} from '@/config/contracts';
import { type ApiAddress, api, QK, type Ticket } from '@/lib/api';
import { fetchMegasteraProofPage, type SerializedMegasteraProof } from '@/lib/backendApi';
import { type PurchasedTicket, readPurchasedTickets } from '@/lib/purchaseReceipt';
import { validateTicketPurchasedFields } from '../../shared/ticketValidation';

const ONE_MINUTE = 60 * 1000;
const WALLET_HISTORY_PAGE_SIZE = 100;
const RECEIPT_CONCURRENCY = 8;
const RECENT_CHAIN_BLOCK_WINDOW = 2_000n;
const ACTIVATION_LOG_CHUNK = 50n;
const HISTORICAL_RPC_URLS = [
  import.meta.env.VITE_RPC_URL ?? '',
  ...(import.meta.env.VITE_RPC_FALLBACK_URLS ?? '').split(','),
]
  .map((value) => value.trim())
  .filter(Boolean)
  .filter((value, index, values) => values.indexOf(value) === index);
const TICKET_PURCHASED_EVENT = parseAbiItem(
  'event TicketPurchased(address indexed recipient, uint256 indexed currentDrawingId, bytes32 indexed source, uint256 userTicketId, uint8[] normals, uint8 bonusball, bytes32 referralScheme)',
);

type HistoryPage = { data: Ticket[]; has_more: boolean; next_cursor: string | null };
type HistoryDependencies = {
  listWalletTickets?: (
    address: ApiAddress,
    options: { limit: number; cursor: string | undefined },
  ) => Promise<HistoryPage>;
  readReceiptTickets?: (
    receipt: TransactionReceipt,
    account: Address,
  ) => readonly PurchasedTicket[];
};

export type MegasteraProofPage = {
  proofs: readonly SerializedMegasteraProof[];
  total: number;
  offset: number;
  limit: number;
};

type MegasteraProofDependencies = {
  listMegasteraProofs?: (
    address: ApiAddress,
    options: { offset: number; limit: number },
  ) => Promise<MegasteraProofPage>;
};

type EligiblePlanetTicketsDependencies = HistoryDependencies & MegasteraProofDependencies;

type RecentChainDependencies = Pick<HistoryDependencies, 'readReceiptTickets'>;

const ACTIVATION_CHAIN_END_BLOCK = MEGAPLANETS_LAUNCH_BLOCK;

async function readTicketLogsRange(
  client: Pick<PublicClient, 'getLogs'>,
  account: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint,
): Promise<Awaited<ReturnType<typeof client.getLogs>>> {
  try {
    return await client.getLogs({
      address: JACKPOT_ADDRESS,
      event: TICKET_PURCHASED_EVENT,
      args: { recipient: account, source: TICKET_SOURCE },
      fromBlock,
      toBlock,
    });
  } catch (error) {
    if (chunkSize <= 1n || fromBlock >= toBlock) throw error;
    const midpoint = fromBlock + (toBlock - fromBlock) / 2n;
    const [left, right] = await Promise.all([
      readTicketLogsRange(client, account, fromBlock, midpoint, chunkSize / 2n),
      readTicketLogsRange(client, account, midpoint + 1n, toBlock, chunkSize / 2n),
    ]);
    return [...left, ...right];
  }
}

async function readTicketLogsInChunks(
  client: Pick<PublicClient, 'getLogs'>,
  account: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
  initialChunkSize: bigint,
): Promise<Awaited<ReturnType<typeof client.getLogs>>> {
  const logs = [] as Awaited<ReturnType<typeof client.getLogs>>;
  for (let chunkStart = fromBlock; chunkStart <= toBlock; ) {
    const chunkEnd =
      chunkStart + initialChunkSize - 1n > toBlock ? toBlock : chunkStart + initialChunkSize - 1n;
    logs.push(
      ...(await readTicketLogsRange(client, account, chunkStart, chunkEnd, initialChunkSize)),
    );
    chunkStart = chunkEnd + 1n;
  }
  return logs;
}

async function readTransactionReceiptWithFallback(
  client: Pick<PublicClient, 'getTransactionReceipt'>,
  hash: `0x${string}`,
): Promise<TransactionReceipt> {
  const readers: Array<Pick<PublicClient, 'getTransactionReceipt'>> = [client];
  for (const url of HISTORICAL_RPC_URLS) {
    readers.push(createPublicClient({ chain: baseSepolia, transport: http(url) }));
  }
  let lastError: unknown;
  for (const reader of readers) {
    try {
      const receipt = await reader.getTransactionReceipt({ hash });
      if (receipt) return receipt;
      lastError = new Error(`Receipt ${hash} was not found on this RPC.`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Receipt ${hash} could not be read.`);
}

function sortEligibleTickets(tickets: readonly PurchasedTicket[]) {
  return [...tickets].sort((left, right) => {
    if (left.drawingId !== right.drawingId) return left.drawingId > right.drawingId ? -1 : 1;
    return left.logIndex > right.logIndex ? -1 : left.logIndex < right.logIndex ? 1 : 0;
  });
}

/** Merges proof/API/RPC discoveries, with later canonical RPC groups winning duplicates. */
export function mergeEligibleTickets(...groups: readonly (readonly PurchasedTicket[])[]) {
  const tickets = new Map<string, PurchasedTicket>();
  for (const group of groups) {
    for (const ticket of group) tickets.set(ticket.ticketId.toString(), ticket);
  }
  return sortEligibleTickets([...tickets.values()]);
}

function parseProofBigInt(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`Megastera proof ${label} is invalid.`);
  const result = BigInt(value);
  if (result < 0n) throw new Error(`Megastera proof ${label} is invalid.`);
  return result;
}

function proofToPurchasedTicket(
  proof: SerializedMegasteraProof,
  account: Address,
): PurchasedTicket {
  if (getAddress(proof.recipient) !== getAddress(account)) {
    throw new Error('Megastera proof recipient does not match the connected wallet.');
  }
  if (
    proof.chainId !== 84_532 ||
    proof.jackpotAddress.toLowerCase() !== JACKPOT_ADDRESS.toLowerCase() ||
    proof.source.toLowerCase() !== TICKET_SOURCE.toLowerCase()
  ) {
    throw new Error('Megastera proof is not canonical for MegaPlanets.');
  }
  if (
    !isHash(proof.originTxHash) ||
    (proof.blockHash !== undefined && !isHash(proof.blockHash)) ||
    !/^\d+$/.test(proof.blockNumber) ||
    parseProofBigInt(proof.blockNumber, 'block number') < MEGAPLANETS_TICKET_START_BLOCK
  ) {
    throw new Error('Megastera proof provenance is invalid.');
  }
  const validated = validateTicketPurchasedFields({
    ticketId: parseProofBigInt(proof.ticketId, 'ticket ID'),
    drawingId: parseProofBigInt(proof.drawingId, 'drawing ID'),
    normals: proof.normals,
    bonusBall: proof.bonusBall,
    logIndex: parseProofBigInt(proof.logIndex, 'log index'),
  });
  return { ...validated, originTxHash: proof.originTxHash };
}

/** Reads durable server proofs as an optional recovery source for old reveals. */
export async function readMegasteraProofsFromServer(
  account: `0x${string}`,
  dependencies: MegasteraProofDependencies = {},
): Promise<readonly PurchasedTicket[]> {
  const listMegasteraProofs =
    dependencies.listMegasteraProofs ??
    ((address, options) => fetchMegasteraProofPage(address, options));
  const proofs: PurchasedTicket[] = [];
  const seen = new Set<string>();
  let offset = 0;
  const limit = 100;
  while (true) {
    const page = await listMegasteraProofs(account, { offset, limit });
    if (page.proofs.length === 0) break;
    for (const proof of page.proofs) {
      const ticket = proofToPurchasedTicket(proof, account);
      const key = ticket.ticketId.toString();
      if (!seen.has(key)) {
        seen.add(key);
        proofs.push(ticket);
      }
    }
    const nextOffset = page.offset + page.proofs.length;
    if (nextOffset <= offset || nextOffset >= page.total) break;
    offset = nextOffset;
  }
  return sortEligibleTickets(proofs);
}

async function mapWithConcurrency<T, Result>(
  values: readonly T[],
  limit: number,
  map: (value: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await map(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

/**
 * Uses the Megapot Data API wallet history only to locate candidate
 * transactions, then validates each candidate against its canonical receipt.
 * Durable server Megastera Proof history is consumed separately as a recovery
 * source; receipt checks and the reveal-time ownerOf gate remain authoritative.
 */
export async function readEligibleTicketsFromWalletHistory(
  client: Pick<PublicClient, 'getTransactionReceipt'>,
  account: `0x${string}`,
  dependencies: HistoryDependencies = {},
): Promise<readonly PurchasedTicket[]> {
  const listWalletTickets = dependencies.listWalletTickets ?? api.walletTickets;
  const readReceiptTickets = dependencies.readReceiptTickets ?? readPurchasedTickets;
  const candidates = new Map<string, `0x${string}`>();
  let cursor: string | undefined;

  do {
    const page = await listWalletTickets(account, { limit: WALLET_HISTORY_PAGE_SIZE, cursor });
    for (const ticket of page.data) {
      if (ticket.block_number >= Number(MEGAPLANETS_TICKET_START_BLOCK)) {
        candidates.set(ticket.user_ticket_id, ticket.tx_hash);
      }
    }
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);

  const receiptsByHash = new Map<string, `0x${string}`>();
  for (const hash of candidates.values()) receiptsByHash.set(hash.toLowerCase(), hash);
  const receipts = await mapWithConcurrency(
    [...receiptsByHash.values()],
    RECEIPT_CONCURRENCY,
    (hash) => readTransactionReceiptWithFallback(client, hash),
  );
  const eligible = new Map<string, PurchasedTicket>();
  for (const receipt of receipts) {
    for (const ticket of readReceiptTickets(receipt, account)) {
      if (candidates.has(ticket.ticketId.toString()))
        eligible.set(ticket.ticketId.toString(), ticket);
    }
  }

  return sortEligibleTickets([...eligible.values()]);
}

/**
 * Recovers newly purchased MegaPlanets tickets directly from Base Sepolia while
 * the eventually consistent Data API is still catching up. The bounded window
 * is split into provider-friendly chunks and every candidate is revalidated from
 * its canonical transaction receipt before being returned.
 */
export async function readRecentEligibleTicketsFromChain(
  client: Pick<PublicClient, 'getBlockNumber' | 'getLogs' | 'getTransactionReceipt'>,
  account: `0x${string}`,
  dependencies: RecentChainDependencies = {},
): Promise<readonly PurchasedTicket[]> {
  const readReceiptTickets = dependencies.readReceiptTickets ?? readPurchasedTickets;
  const latestBlock = await client.getBlockNumber();
  const fromBlock =
    latestBlock >= RECENT_CHAIN_BLOCK_WINDOW ? latestBlock - RECENT_CHAIN_BLOCK_WINDOW + 1n : 0n;
  const logs = await readTicketLogsInChunks(
    client,
    account,
    fromBlock,
    latestBlock,
    RECENT_CHAIN_BLOCK_WINDOW,
  );
  const receiptHashes = new Map<string, `0x${string}`>();
  for (const log of logs) {
    if (log.transactionHash)
      receiptHashes.set(log.transactionHash.toLowerCase(), log.transactionHash);
  }
  const receipts = await mapWithConcurrency(
    [...receiptHashes.values()],
    RECEIPT_CONCURRENCY,
    (hash) => readTransactionReceiptWithFallback(client, hash),
  );
  return mergeEligibleTickets(...receipts.map((receipt) => readReceiptTickets(receipt, account)));
}

/**
 * Recovers the bounded launch activation window. The first canonical
 * MegaPlanets tickets were purchased a few hundred blocks before the Planet
 * contract launch gate, so relying only on the current Data API or a recent
 * chain window loses these tickets for wallets that bought during activation.
 */
export async function readActivationEligibleTicketsFromChain(
  client: Pick<PublicClient, 'getLogs' | 'getTransactionReceipt'>,
  account: `0x${string}`,
  dependencies: RecentChainDependencies = {},
): Promise<readonly PurchasedTicket[]> {
  const readReceiptTickets = dependencies.readReceiptTickets ?? readPurchasedTickets;
  const logs = await readTicketLogsInChunks(
    client,
    account,
    MEGAPLANETS_TICKET_START_BLOCK,
    ACTIVATION_CHAIN_END_BLOCK,
    ACTIVATION_LOG_CHUNK,
  );
  const receiptHashes = new Map<string, `0x${string}`>();
  for (const log of logs) {
    if (log.transactionHash)
      receiptHashes.set(log.transactionHash.toLowerCase(), log.transactionHash);
  }
  const receipts = await mapWithConcurrency(
    [...receiptHashes.values()],
    RECEIPT_CONCURRENCY,
    (hash) => readTransactionReceiptWithFallback(client, hash),
  );
  return mergeEligibleTickets(...receipts.map((receipt) => readReceiptTickets(receipt, account)));
}

export async function readEligiblePlanetTickets(
  client: Pick<PublicClient, 'getBlockNumber' | 'getLogs' | 'getTransactionReceipt'>,
  account: `0x${string}`,
  dependencies: EligiblePlanetTicketsDependencies = {},
): Promise<readonly PurchasedTicket[]> {
  const [proofResult, historyResult, activationResult, recentResult] = await Promise.allSettled([
    readMegasteraProofsFromServer(account, dependencies),
    readEligibleTicketsFromWalletHistory(client, account, dependencies),
    readActivationEligibleTicketsFromChain(client, account, dependencies),
    readRecentEligibleTicketsFromChain(client, account, dependencies),
  ]);
  const proofs = proofResult.status === 'fulfilled' ? proofResult.value : [];
  const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const chainGroups = [
    activationResult.status === 'fulfilled' ? activationResult.value : [],
    recentResult.status === 'fulfilled' ? recentResult.value : [],
  ];
  const merged = mergeEligibleTickets(proofs, history, ...chainGroups);
  if (merged.length === 0) {
    // An empty result is authoritative only when every recovery source completed.
    // Preserve the original provider error so the query can surface a retryable
    // outage instead of telling the wallet that it owns no eligible tickets.
    const failedSource = [recentResult, activationResult, historyResult, proofResult].find(
      (result) => result.status === 'rejected',
    );
    if (failedSource?.status === 'rejected') throw failedSource.reason;
  }
  return merged;
}

export function shouldEnableEligiblePlanetTickets(input: {
  chain: string;
  hasAddress: boolean;
  hasClient: boolean;
  requested: boolean;
}): boolean {
  return input.chain === 'testnet' && input.hasAddress && input.hasClient && input.requested;
}

/** Discovers eligible tickets from server proofs, canonical receipts, and recent RPC recovery. */
export function useEligiblePlanetTickets(
  address: `0x${string}` | undefined,
  options: { refetchInterval?: number; enabled?: boolean } = {},
) {
  const client = usePublicClient();
  const query = useQuery({
    queryKey: [QK.NS, 'eligible-planet-tickets', CHAIN, address],
    queryFn: () => {
      if (!client || !address)
        throw new Error('A public RPC client and connected wallet are required.');
      return readEligiblePlanetTickets(client as PublicClient, address);
    },
    enabled: shouldEnableEligiblePlanetTickets({
      chain: CHAIN,
      hasAddress: !!address,
      hasClient: !!client,
      requested: options.enabled ?? true,
    }),
    staleTime: ONE_MINUTE,
    refetchInterval: options.refetchInterval,
  });
  return { tickets: query.data ?? [], ...query };
}
