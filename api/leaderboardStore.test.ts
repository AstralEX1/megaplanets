import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import {
  calculateLeaderboardRows,
  finalizeLeaderboardPeriod,
  paginateLeaderboardRows,
} from './leaderboardStore';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const PERIOD = {
  id: '2026-08-10',
  startsAt: new Date('2026-08-10T00:00:00.000Z'),
  endsAt: new Date('2026-08-17T00:00:00.000Z'),
};

describe('calculateLeaderboardRows', () => {
  it('combines canonical closed segments with active production inside the current week', () => {
    const rows = calculateLeaderboardRows({
      period: PERIOD,
      asOf: new Date('2026-08-11T00:00:00.000Z'),
      ledger: [{
        ownerAddress: ADDRESS_A,
        startedAt: new Date('2026-08-10T00:00:00.000Z'),
        endedAt: new Date('2026-08-10T12:00:00.000Z'),
        baseMineralsPerDay: 24n,
        multiplierBps: 10_000,
        amountMicros: 12_000_000n,
      }],
      active: [
        {
          ownerAddress: ADDRESS_A,
          startedAt: new Date('2026-08-10T12:00:00.000Z'),
          multiplierBps: 10_000,
          remainder: 0n,
          planet: { baseMineralsPerDay: 24n },
        },
        {
          ownerAddress: ADDRESS_B,
          startedAt: new Date('2026-08-10T00:00:00.000Z'),
          multiplierBps: 10_000,
          remainder: 0n,
          planet: { baseMineralsPerDay: 12n },
        },
      ],
    });

    expect(rows).toEqual([
      { rank: 1, walletAddress: ADDRESS_A, scoreMicros: 24_000_000n, effectiveMineralsPerDayMicros: 24_000_000n },
      { rank: 2, walletAddress: ADDRESS_B, scoreMicros: 12_000_000n, effectiveMineralsPerDayMicros: 12_000_000n },
    ]);
  });

  it('does not count active production after the period end', () => {
    const rows = calculateLeaderboardRows({
      period: PERIOD,
      asOf: new Date('2026-08-20T00:00:00.000Z'),
      ledger: [],
      active: [{
        ownerAddress: ADDRESS_A,
        startedAt: new Date('2026-08-16T00:00:00.000Z'),
        multiplierBps: 10_000,
        remainder: 0n,
        planet: { baseMineralsPerDay: 10n },
      }],
    });

    expect(rows[0]).toMatchObject({ scoreMicros: 10_000_000n, effectiveMineralsPerDayMicros: 0n });
  });
});

describe('paginateLeaderboardRows', () => {
  it('returns bounded rows and the original total', () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      rank: index + 1,
      walletAddress: `wallet-${index + 1}`,
      scoreMicros: BigInt(5 - index),
      effectiveMineralsPerDayMicros: 1n,
    }));

    expect(paginateLeaderboardRows(rows, { offset: 1, limit: 2 })).toEqual({
      total: 5,
      offset: 1,
      limit: 2,
      rows: rows.slice(1, 3),
    });
  });
});

describe('finalizeLeaderboardPeriod', () => {
  it('archives a period only once when finalization is retried', async () => {
    let periodRecord: { id: string; finalizedAt: Date } | undefined;
    let periodWrites = 0;
    let lockCalls = 0;
    const transaction = {
      $queryRaw: async () => { lockCalls += 1; },
      leaderboardPeriod: {
        findUnique: async () => periodRecord,
        upsert: async ({ create }: { create: { id: string; finalizedAt: Date } }) => {
          periodWrites += 1;
          periodRecord = { id: create.id, finalizedAt: create.finalizedAt };
          return periodRecord;
        },
      },
      leaderboardEntry: {
        createMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
      mineralLedgerEntry: {
        findMany: async () => [],
        create: async () => undefined,
      },
      planetAccrualState: {
        findMany: async () => [],
        update: async () => undefined,
      },
    };
    const prisma = {
      $transaction: async (operation: (client: typeof transaction) => Promise<unknown>) => operation(transaction),
    } as unknown as PrismaClient;

    await finalizeLeaderboardPeriod(prisma, PERIOD, new Date('2026-08-17T00:00:01.000Z'));
    await finalizeLeaderboardPeriod(prisma, PERIOD, new Date('2026-08-17T00:01:00.000Z'));

    expect(periodWrites).toBe(1);
    expect(lockCalls).toBe(2);
  });
});
