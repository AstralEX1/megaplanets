import { describe, expect, it, vi } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_LAUNCH_BLOCK } from './config';
import { BASE_SEPOLIA_JACKPOT } from './eligibility';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaEligibilityStore } from './prismaEligibilityStore';

const planetContract = '0x0000000000000000000000000000000000000003' as const;

describe('PrismaEligibilityStore reorg resets', () => {
  it('rewinds ticket provenance in FK-safe order without touching legacy snapshots', async () => {
    const calls: string[] = [];
    const transaction = {
      mineralLedgerEntry: { deleteMany: vi.fn(async () => { calls.push('mineralLedgerEntry.deleteMany'); }) },
      planetAccrualState: { deleteMany: vi.fn(async () => { calls.push('planetAccrualState.deleteMany'); }) },
      planetOwnershipHistory: { deleteMany: vi.fn(async () => { calls.push('planetOwnershipHistory.deleteMany'); }) },
      processedBlockchainEvent: { deleteMany: vi.fn(async () => { calls.push('processedBlockchainEvent.deleteMany'); }) },
      planet: {
        findMany: async () => [],
        deleteMany: vi.fn(async () => { calls.push('planet.deleteMany'); }),
      },
      mintVoucherRecord: { deleteMany: vi.fn(async () => { calls.push('mintVoucherRecord.deleteMany'); }) },
      ticketPurchase: { deleteMany: vi.fn(async () => { calls.push('ticketPurchase.deleteMany'); }) },
      indexerCursor: { updateMany: vi.fn(async () => { calls.push('indexerCursor.updateMany'); }) },
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
      'mineralLedgerEntry.deleteMany',
      'planetAccrualState.deleteMany',
      'planetOwnershipHistory.deleteMany',
      'processedBlockchainEvent.deleteMany',
      'planet.deleteMany',
      'mintVoucherRecord.deleteMany',
      'ticketPurchase.deleteMany',
      'indexerCursor.updateMany',
    ]);
    expect(transaction.indexerCursor.updateMany).toHaveBeenCalledWith({
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
      data: { nextBlock: MEGAPLANETS_LAUNCH_BLOCK, lastBlockHash: null },
    });
    expect(transaction.planet.deleteMany).toHaveBeenCalledWith({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContract.toLowerCase(), mintBlockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } } });
    expect(transaction.processedBlockchainEvent.deleteMany).toHaveBeenCalledWith({ where: { chainId: 84532, contractAddress: planetContract.toLowerCase(), blockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } } });
    expect(transaction.ticketPurchase.deleteMany).toHaveBeenCalledWith({
      where: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } },
    });
    expect(transaction.mintVoucherRecord.deleteMany).toHaveBeenCalledWith({
      where: { ticketPurchase: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } } },
    });
  });
});
