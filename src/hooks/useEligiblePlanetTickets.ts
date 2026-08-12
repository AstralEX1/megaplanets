import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, parseAbiItem, type Address, type PublicClient, type TransactionReceipt } from 'viem';
import { baseSepolia } from 'viem/chains';
import { usePublicClient } from 'wagmi';
import {
  CHAIN,
  JACKPOT_ADDRESS,
  MEGAPLANETS_LAUNCH_BLOCK,
  MEGAPLANETS_TICKET_START_BLOCK,
  TICKET_SOURCE,
} from '@/config/contracts';
import { api, type ApiAddress, type Ticket, QK } from '@/lib/api';
import { readPurchasedTickets, type PurchasedTicket } from '@/lib/purchaseReceipt';

const ONE_MINUTE = 60 * 1000;
const WALLET_HISTORY_PAGE_SIZE = 100;
const RECEIPT_CONCURRENCY = 8;
const RECENT_CHAIN_BLOCK_WINDOW = 2_000n;
const ACTIVATION_LOG_CHUNK = 50n;
const HISTORICAL_RPC_URLS = [
  import.meta.env.VITE_RPC_URL ?? '',
  ...(import.meta.env.VITE_RPC_FALLBACK_URLS ?? '').split(','),
].map((value) => value.trim()).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index);
const TICKET_PURCHASED_EVENT = parseAbiItem(
  'event TicketPurchased(address indexed recipient, uint256 indexed currentDrawingId, bytes32 indexed source, uint256 userTicketId, uint8[] normals, uint8 bonusball, bytes32 referralScheme)',
);

type HistoryPage = { data: Ticket[]; has_more: boolean; next_cursor: string | null };
type HistoryDependencies = {
  listWalletTickets?: (address: ApiAddress, options: { limit: number; cursor: string | undefined }) => Promise<HistoryPage>;
  readReceiptTickets?: (receipt: TransactionReceipt, account: Address) => readonly PurchasedTicket[];
};

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
  for (let chunkStart = fromBlock; chunkStart <= toBlock;) {
    const chunkEnd = chunkStart + initialChunkSize - 1n > toBlock
      ? toBlock
      : chunkStart + initialChunkSize - 1n;
    logs.push(...await readTicketLogsRange(client, account, chunkStart, chunkEnd, initialChunkSize));
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

function mergeEligibleTickets(...groups: readonly (readonly PurchasedTicket[])[]) {
  const tickets = new Map<string, PurchasedTicket>();
  for (const group of groups) {
    for (const ticket of group) tickets.set(ticket.ticketId.toString(), ticket);
  }
  return sortEligibleTickets([...tickets.values()]);
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
 * Uses the indexed wallet history only to locate candidate transactions, then
 * validates each candidate against its canonical receipt before it can mint.
 * This avoids an impractical full-chain browser scan while retaining source
 * and recipient checks from `readPurchasedTickets`.
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
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
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
      if (candidates.has(ticket.ticketId.toString())) eligible.set(ticket.ticketId.toString(), ticket);
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
    latestBlock >= RECENT_CHAIN_BLOCK_WINDOW
      ? latestBlock - RECENT_CHAIN_BLOCK_WINDOW + 1n
      : 0n;
  const logs = await readTicketLogsInChunks(client, account, fromBlock, latestBlock, RECENT_CHAIN_BLOCK_WINDOW);
  const receiptHashes = new Map<string, `0x${string}`>();
  for (const log of logs) {
    if (log.transactionHash) receiptHashes.set(log.transactionHash.toLowerCase(), log.transactionHash);
  }
  const receipts = await mapWithConcurrency(
    [...receiptHashes.values()],
    RECEIPT_CONCURRENCY,
    (hash) => readTransactionReceiptWithFallback(client, hash),
  );
  return mergeEligibleTickets(
    ...receipts.map((receipt) => readReceiptTickets(receipt, account)),
  );
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
    if (log.transactionHash) receiptHashes.set(log.transactionHash.toLowerCase(), log.transactionHash);
  }
  const receipts = await mapWithConcurrency(
    [...receiptHashes.values()],
    RECEIPT_CONCURRENCY,
    (hash) => readTransactionReceiptWithFallback(client, hash),
  );
  return mergeEligibleTickets(
    ...receipts.map((receipt) => readReceiptTickets(receipt, account)),
  );
}

export async function readEligiblePlanetTickets(
  client: Pick<PublicClient, 'getBlockNumber' | 'getLogs' | 'getTransactionReceipt'>,
  account: `0x${string}`,
): Promise<readonly PurchasedTicket[]> {
  const [historyResult, activationResult, recentResult] = await Promise.allSettled([
    readEligibleTicketsFromWalletHistory(client, account),
    readActivationEligibleTicketsFromChain(client, account),
    readRecentEligibleTicketsFromChain(client, account),
  ]);
  const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const chainGroups = [
    activationResult.status === 'fulfilled' ? activationResult.value : [],
    recentResult.status === 'fulfilled' ? recentResult.value : [],
  ];
  if (history.length === 0 && chainGroups.every((group) => group.length === 0) && activationResult.status === 'rejected') {
    throw activationResult.reason;
  }
  return mergeEligibleTickets(history, ...chainGroups);
}

/** Discovers historical on-chain tickets without treating Data API indexing as purchase proof. */
export function useEligiblePlanetTickets(
  address: `0x${string}` | undefined,
  options: { refetchInterval?: number } = {},
) {
  const client = usePublicClient();
  const query = useQuery({
    queryKey: [QK.NS, 'eligible-planet-tickets', CHAIN, address],
    queryFn: () => {
      if (!client || !address) throw new Error('A public RPC client and connected wallet are required.');
      return readEligiblePlanetTickets(client as PublicClient, address);
    },
    enabled: CHAIN === 'testnet' && !!address && !!client,
    staleTime: ONE_MINUTE,
    refetchInterval: options.refetchInterval,
  });
  return { tickets: query.data ?? [], ...query };
}
