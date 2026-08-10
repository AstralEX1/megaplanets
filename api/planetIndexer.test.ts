import { describe, expect, it } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID } from './config';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaPlanetIndexStore, type PlanetTransferEvent } from './planetIndexer';

const previousOwner = '0x0000000000000000000000000000000000000001' as const;
const nextOwner = '0x0000000000000000000000000000000000000002' as const;
const planetContract = '0x0000000000000000000000000000000000000003' as const;

describe('PrismaPlanetIndexStore mining settlements', () => {
  it('settles a transferred Planet for the previous owner before changing ownership', async () => {
    let currentOwner = previousOwner;
    const accrualState = {
      planetId: 'planet-1',
      ownerAddress: previousOwner,
      startedAt: new Date('2026-08-10T00:00:00.000Z'),
      multiplierBps: 10_000,
      remainder: 0n,
    };
    const ledger: Array<{ ownerAddress: string; amountMicros: bigint }> = [];
    const planet = { id: 'planet-1', ownerAddress: previousOwner, baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const transaction = {
      planet: {
        findUnique: async () => ({ ...planet, ownerAddress: currentOwner }),
        findMany: async ({ where }: { where: { ownerAddress: string } }) =>
          where.ownerAddress === currentOwner ? [planet] : [],
        update: async ({ data }: { data: { ownerAddress: typeof previousOwner } }) => {
          currentOwner = data.ownerAddress;
        },
      },
      planetOwnershipHistory: { create: async () => undefined },
      planetAccrualState: {
        findMany: async () => [accrualState],
        create: async () => undefined,
        update: async ({ data }: { data: Partial<typeof accrualState> }) => Object.assign(accrualState, data),
        updateMany: async ({ data }: { data: Partial<typeof accrualState> }) => Object.assign(accrualState, data),
      },
      mineralLedgerEntry: {
        create: async ({ data }: { data: { ownerAddress: string; amountMicros: bigint } }) => ledger.push(data),
      },
      processedBlockchainEvent: { create: async () => undefined },
    };
    const prisma = {
      processedBlockchainEvent: { findUnique: async () => null },
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient;
    const event: PlanetTransferEvent = {
      chainId: BASE_SEPOLIA_CHAIN_ID,
      contractAddress: planetContract,
      tokenId: 42n,
      from: previousOwner,
      to: nextOwner,
      transactionHash: `0x${'44'.repeat(32)}`,
      blockNumber: 42n,
      blockHash: `0x${'55'.repeat(32)}`,
      logIndex: 7,
      blockTimestamp: new Date('2026-08-10T00:00:01.000Z'),
    };

    await new PrismaPlanetIndexStore(prisma).recordTransfer(event);

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ ownerAddress: previousOwner, amountMicros: 1_000_000n });
    expect(currentOwner).toBe(nextOwner);
  });
});
