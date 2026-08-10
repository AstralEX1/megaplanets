import { createPublicClient, http, stringToHex, type Log } from 'viem';
import { baseSepolia } from 'viem/chains';
import { MEGAPLANETS_SOURCE } from './config';
import { BASE_SEPOLIA_JACKPOT, decodeEligibleTicket, TICKET_PURCHASED_ABI } from './eligibility';
import type { EligibilityStore } from './store';

export type EligibilityIndexerOptions = {
  confirmations?: bigint;
  blockRange?: bigint;
};

export type EligibilityIndexResult = {
  fromBlock?: bigint;
  throughBlock: bigint;
  ticketsIndexed: number;
};

export type TicketIndexerConfig = { rpcUrl: string; launchBlock: bigint };

/**
 * Indexes finalized canonical purchase events in bounded chunks. This function is deliberately
 * not invoked by the HTTP server; a scheduler must call it with a durable store.
 */
export async function indexEligibleTickets(config: TicketIndexerConfig, store: EligibilityStore, options: EligibilityIndexerOptions = {}): Promise<EligibilityIndexResult> {
  const confirmations = options.confirmations ?? 6n;
  const blockRange = options.blockRange ?? 2_000n;
  if (confirmations < 0n || blockRange < 1n) throw new Error('Indexer confirmations and blockRange must be valid positive values.');

  const client = createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
  const latestBlock = await client.getBlockNumber();
  const throughBlock = latestBlock > confirmations ? latestBlock - confirmations : 0n;
  const cursor = await store.getCursor();
  const startBlock = cursor === undefined ? config.launchBlock : cursor + 1n;
  if (startBlock > throughBlock) return { throughBlock, ticketsIndexed: 0 };

  let ticketsIndexed = 0;
  for (let fromBlock = startBlock; fromBlock <= throughBlock;) {
    const toBlock = fromBlock + blockRange - 1n > throughBlock ? throughBlock : fromBlock + blockRange - 1n;
    const logs = await client.getLogs({
      address: BASE_SEPOLIA_JACKPOT,
      event: TICKET_PURCHASED_ABI[0],
      args: { source: stringToHex(MEGAPLANETS_SOURCE, { size: 32 }) },
      fromBlock,
      toBlock,
    });
    const blocks = new Map<string, Awaited<ReturnType<typeof client.getBlock>>>();
    for (const log of logs) {
      if (!log.blockHash) throw new Error('Finalized TicketPurchased log has no block hash.');
      let block = blocks.get(log.blockHash);
      if (!block) {
        block = await client.getBlock({ blockHash: log.blockHash });
        blocks.set(log.blockHash, block);
      }
      await store.saveTicket({
        ...decodeEligibleTicket(log as Log),
        blockHash: log.blockHash,
        purchasedAt: new Date(Number(block.timestamp) * 1_000),
      });
      ticketsIndexed += 1;
    }
    await store.setCursor(toBlock);
    fromBlock = toBlock + 1n;
  }
  return { fromBlock: startBlock, throughBlock, ticketsIndexed };
}
