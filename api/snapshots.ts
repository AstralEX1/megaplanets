import type { Stage5Config } from './config';
import { getPlanetHoldingsAtBlock } from './holdings';
import { createDailySnapshot, type DailySnapshot, type PlanetHolding } from './scoring';
import type { EligibilityStore } from './store';

export type SnapshotSource = { getLatestBlock: () => Promise<bigint>; getHoldingsAtBlock: (blockNumber: bigint) => Promise<PlanetHolding[]> };

export function selectFinalizedBlock(latestBlock: bigint, confirmations = 6n): bigint {
  if (latestBlock < 0n || confirmations < 0n || latestBlock < confirmations) throw new Error('No finalized block is available for the requested confirmation depth.');
  return latestBlock - confirmations;
}

/** Captures one reproducible score report. A scheduler may call this later; the API never does. */
export async function captureDailySnapshot(store: EligibilityStore, source: SnapshotSource, now = () => new Date(), confirmations = 6n): Promise<DailySnapshot> {
  const blockNumber = selectFinalizedBlock(await source.getLatestBlock(), confirmations);
  if (await store.getSnapshot(blockNumber)) throw new Error(`Snapshot for block ${blockNumber} already exists.`);
  const snapshot = createDailySnapshot({ blockNumber, capturedAt: now().toISOString(), holdings: await source.getHoldingsAtBlock(blockNumber) });
  await store.saveSnapshot(snapshot);
  return snapshot;
}

/** Production source for the explicit snapshot job; it is intentionally not started on import. */
export function createViemSnapshotSource(config: Stage5Config): SnapshotSource {
  return {
    getLatestBlock: async () => {
      const { createPublicClient, http } = await import('viem');
      const { baseSepolia } = await import('viem/chains');
      return createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) }).getBlockNumber();
    },
    getHoldingsAtBlock: (blockNumber) => getPlanetHoldingsAtBlock(config, blockNumber),
  };
}
