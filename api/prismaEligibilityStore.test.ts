import { describe, expect, it, vi } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_LAUNCH_BLOCK } from './config';
import { BASE_SEPOLIA_JACKPOT } from './eligibility';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaEligibilityStore } from './prismaEligibilityStore';

const planetContract = '0x0000000000000000000000000000000000000003' as const;

describe('PrismaEligibilityStore reorg resets', () => {
  it('rewinds ticket provenance in FK-safe order and clears both cursors', async () => {
    const calls: string[] = [];
    const transaction = {
      leaderboardEntry: { deleteMany: async () => { calls.push('leaderboardEntry.deleteMany'); } },
      leaderboardPeriod: { deleteMany: async () => { calls.push('leaderboardPeriod.deleteMany'); } },
      dailySnapshotRecord: { deleteMany: async () => { calls.push('dailySnapshotRecord.deleteMany'); } },
      mineralLedgerEntry: { deleteMany: async () => { calls.push('mineralLedgerEntry.deleteMany'); } },
      planetAccrualState: { deleteMany: async () => { calls.push('planetAccrualState.deleteMany'); } },
      planetOwnershipHistory: { deleteMany: async () => { calls.push('planetOwnershipHistory.deleteMany'); } },
      processedBlockchainEvent: { deleteMany: async () => { calls.push('processedBlockchainEvent.deleteMany'); } },
      planet: { deleteMany: async () => { calls.push('planet.deleteMany'); } },
      mintVoucherRecord: { deleteMany: async () => { calls.push('mintVoucherRecord.deleteMany'); } },
      ticketPurchase: { deleteMany: async () => { calls.push('ticketPurchase.deleteMany'); } },
      indexerCursor: { deleteMany: vi.fn(async () => { calls.push('indexerCursor.deleteMany'); }) },
    };
    const prisma = {
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient;

    const store = new PrismaEligibilityStore(prisma, planetContract);
    const rewind = (store as { rewind?: (fromBlock: bigint) => Promise<void> }).rewind;

    expect(rewind).toBeTypeOf('function');
    if (!rewind) return;

    await rewind.call(store, MEGAPLANETS_LAUNCH_BLOCK);

    expect(calls).toEqual([
      'leaderboardEntry.deleteMany',
      'leaderboardPeriod.deleteMany',
      'dailySnapshotRecord.deleteMany',
      'mineralLedgerEntry.deleteMany',
      'planetAccrualState.deleteMany',
      'planetOwnershipHistory.deleteMany',
      'processedBlockchainEvent.deleteMany',
      'planet.deleteMany',
      'mintVoucherRecord.deleteMany',
      'ticketPurchase.deleteMany',
      'indexerCursor.deleteMany',
    ]);
    expect(transaction.indexerCursor.deleteMany).toHaveBeenCalledWith({
      where: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        OR: [
          {
            contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
            stream: 'megapot-tickets',
          },
          {
            contractAddress: planetContract.toLowerCase(),
            stream: 'megaplanets-v2',
          },
        ],
      },
    });
  });
});
