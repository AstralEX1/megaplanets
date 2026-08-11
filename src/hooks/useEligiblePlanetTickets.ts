import { useQuery } from '@tanstack/react-query';
import { parseAbiItem, type Address, type PublicClient, type TransactionReceipt } from 'viem';
import { usePublicClient } from 'wagmi';
import {
  CHAIN,
  JACKPOT_ADDRESS,
  MEGAPLANETS_LAUNCH_BLOCK,
  TICKET_SOURCE,
} from '@/config/contracts';
import { api, type ApiAddress, type Ticket, QK } from '@/lib/api';
import { readPurchasedTickets, type PurchasedTicket } from '@/lib/purchaseReceipt';

const ONE_MINUTE = 60 * 1000;
const WALLET_HISTORY_PAGE_SIZE = 100;
const RECEIPT_CONCURRENCY = 8;
const RECENT_CHAIN_BLOCK_WINDOW = 2_000n;
const TICKET_PURCHASED_EVENT = parseAbiItem(
  'event TicketPurchased(address indexed recipient, uint256 indexed currentDrawingId, bytes32 indexed source, uint256 userTicketId, uint8[] normals, uint8 bonusball, bytes32 referralScheme)',
);

type HistoryPage = { data: Ticket[]; has_more: boolean; next_cursor: string | null };
type HistoryDependencies = {
  listWalletTickets?: (address: ApiAddress, options: { limit: number; cursor: string | undefined }) => Promise<HistoryPage>;
  readReceiptTickets?: (receipt: TransactionReceipt, account: Address) => readonly PurchasedTicket[];
};

type RecentChainDependencies = Pick<HistoryDependencies, 'readReceiptTickets'>;

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
      if (ticket.block_number >= Number(MEGAPLANETS_LAUNCH_BLOCK)) {
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
    (hash) => client.getTransactionReceipt({ hash }),
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
 * keeps this to one RPC log request and every candidate is revalidated from its
 * canonical transaction receipt before being returned.
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
  const logs = await client.getLogs({
    address: JACKPOT_ADDRESS,
    event: TICKET_PURCHASED_EVENT,
    args: { recipient: account, source: TICKET_SOURCE },
    fromBlock,
    toBlock: latestBlock,
  });
  const receiptHashes = new Map<string, `0x${string}`>();
  for (const log of logs) {
    if (log.transactionHash) receiptHashes.set(log.transactionHash.toLowerCase(), log.transactionHash);
  }
  const receipts = await mapWithConcurrency(
    [...receiptHashes.values()],
    RECEIPT_CONCURRENCY,
    (hash) => client.getTransactionReceipt({ hash }),
  );
  return mergeEligibleTickets(
    ...receipts.map((receipt) => readReceiptTickets(receipt, account)),
  );
}

export async function readEligiblePlanetTickets(
  client: Pick<PublicClient, 'getBlockNumber' | 'getLogs' | 'getTransactionReceipt'>,
  account: `0x${string}`,
): Promise<readonly PurchasedTicket[]> {
  const [history, recent] = await Promise.all([
    readEligibleTicketsFromWalletHistory(client, account),
    readRecentEligibleTicketsFromChain(client, account),
  ]);
  return mergeEligibleTickets(history, recent);
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
