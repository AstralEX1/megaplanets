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
  it('calculates lifetime production from immutable Planet traits and mint times', () => {
    const rows = calculateLeaderboardRows({
      period: PERIOD,
      asOf: new Date('2026-08-11T00:00:00.000Z'),
      planets: [
        {
          ownerAddress: ADDRESS_A,
          baseMineralsPerDay: 24n,
          mintedAt: new Date('2026-08-09T00:00:00.000Z'),
        },
        {
          ownerAddress: ADDRESS_B,
          baseMineralsPerDay: 12n,
          mintedAt: new Date('2026-08-10T00:00:00.000Z'),
        },
      ],
    });

    expect(rows).toEqual([
      {
        rank: 1,
        walletAddress: ADDRESS_A,
        scoreMicros: 48_000_000n,
        effectiveMineralsPerDayMicros: 24_000_000n,
      },
      {
        rank: 2,
        walletAddress: ADDRESS_B,
        scoreMicros: 12_000_000n,
        effectiveMineralsPerDayMicros: 12_000_000n,
      },
    ]);
  });

  it('does not count a Planet minted after the UTC snapshot boundary', () => {
    const rows = calculateLeaderboardRows({
      period: PERIOD,
      asOf: new Date('2026-08-20T00:00:00.000Z'),
      planets: [
        {
          ownerAddress: ADDRESS_A,
          baseMineralsPerDay: 10n,
          mintedAt: new Date('2026-08-20T00:00:00.000Z'),
        },
      ],
    });

    expect(rows).toEqual([]);
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
      $queryRaw: async () => {
        lockCalls += 1;
      },
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
      planet: { findMany: async () => [] },
    };
    const prisma = {
      $transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as unknown as PrismaClient;

    await finalizeLeaderboardPeriod(prisma, PERIOD, new Date('2026-08-17T00:00:01.000Z'));
    await finalizeLeaderboardPeriod(prisma, PERIOD, new Date('2026-08-17T00:01:00.000Z'));

    expect(periodWrites).toBe(1);
    expect(lockCalls).toBe(2);
  });
});

describe('daily leaderboard finalization', () => {
  it('persists one deterministic daily snapshot and serves it as the latest completed result', async () => {
    const period = {
      id: '2026-08-10',
      startsAt: new Date('2026-08-10T00:00:00.000Z'),
      endsAt: new Date('2026-08-11T00:00:00.000Z'),
    };
    let periodRecord: { id: string; startsAt: Date; endsAt: Date; finalizedAt: Date } | undefined;
    const entries = [
      {
        rank: 1,
        walletAddress: ADDRESS_A,
        scoreMicros: 48_000_000n,
        effectiveMineralsPerDayMicros: 24_000_000n,
      },
    ];
    const transaction = {
      $queryRaw: async () => undefined,
      leaderboardPeriod: {
        findUnique: async () => periodRecord,
        upsert: async ({ create }: { create: typeof period }) => {
          periodRecord = { ...create, finalizedAt: new Date('2026-08-11T00:00:01.000Z') };
          return periodRecord;
        },
      },
      leaderboardEntry: {
        createMany: async () => ({ count: entries.length }),
        findMany: async () => entries,
      },
      planet: {
        findMany: async () => [
          {
            ownerAddress: ADDRESS_A,
            baseMineralsPerDay: 24n,
            mintedAt: new Date('2026-08-09T00:00:00.000Z'),
          },
        ],
      },
    };
    const prisma = {
      $transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
      leaderboardPeriod: {
        findFirst: async () => periodRecord,
      },
      leaderboardEntry: {
        findMany: async () => entries,
      },
    } as unknown as PrismaClient;

    await finalizeLeaderboardPeriod(prisma, period, new Date('2026-08-11T00:00:01.000Z'));
    const current = await (await import('./leaderboardStore')).getCurrentLeaderboard(
      prisma,
      new Date('2026-08-11T00:01:00.000Z'),
      { offset: 0, limit: 50 },
    );

    expect(current.asOf).toEqual(new Date('2026-08-11T00:00:01.000Z'));
    expect(current.rows).toEqual(entries);
  });
});
