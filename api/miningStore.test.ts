import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import { getWalletMiningSnapshot } from './miningStore';

describe('getWalletMiningSnapshot', () => {
  it('includes settled earnings from transferred Planets and pending earnings from current Planets', async () => {
    const ownerAddress = '0x0000000000000000000000000000000000000001';
    const prisma = {
      planet: {
        findMany: async () => [
          {
            baseMineralsPerDay: 86_400n,
            accrualState: {
              startedAt: new Date('2026-08-10T00:00:00.000Z'),
              multiplierBps: 10_000,
              remainder: 0n,
            },
          },
          {
            baseMineralsPerDay: 172_800n,
            accrualState: {
              startedAt: new Date('2026-08-10T00:00:00.000Z'),
              multiplierBps: 10_500,
              remainder: 0n,
            },
          },
        ],
      },
      mineralLedgerEntry: {
        aggregate: async () => ({ _sum: { amountMicros: 7_000_000n } }),
      },
    } as unknown as PrismaClient;

    const snapshot = await getWalletMiningSnapshot(prisma, ownerAddress, new Date('2026-08-10T00:00:01.000Z'));

    expect(snapshot).toEqual({
      ownerAddress,
      ownedPlanetCount: 2,
      pendingMicros: '3100000',
      earnedMicros: '10100000',
    });
  });
});
