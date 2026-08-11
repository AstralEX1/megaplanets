import { describe, expect, it } from 'vitest';
import { selectFinalizedBlock, captureDailySnapshot, type SnapshotSource } from './snapshots';
import { MemoryEligibilityStore } from './store';

const source: SnapshotSource = {
  getLatestBlock: async () => 100n,
  getHoldingsAtBlock: async () => [{ holder: '0x1111111111111111111111111111111111111111', tokenId: 1n, planetType: 'Nebula', minerals: 10n }],
};

describe('daily snapshot job', () => {
  it('selects a finalized block and stores a reproducible report once', async () => {
    const store = new MemoryEligibilityStore();
    const snapshot = await captureDailySnapshot(store, source, () => new Date('2026-08-04T00:00:00.000Z'));
    expect(snapshot.blockNumber).toBe(94n);
    expect(snapshot.holdings).toHaveLength(1);
    expect(await store.getSnapshot(94n)).toEqual(snapshot);
    await expect(captureDailySnapshot(store, source)).rejects.toThrow('already exists');
  });

  it('rejects an unavailable confirmation depth', () => {
    expect(() => selectFinalizedBlock(5n, 6n)).toThrow('No finalized block');
  });
});
