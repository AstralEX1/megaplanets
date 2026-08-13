import type { Prisma, PrismaClient } from './generated/prisma/client';
import {
  getDistanceToNextRank,
  getLeaderboardPeriod,
  type LeaderboardPeriodBounds,
  type RankedLeaderboardRow,
  rankLeaderboardRows,
} from './leaderboard';
import { calculateLifetimeMinerals, MINERAL_SCALE } from './mining';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export type LifetimeLeaderboardPlanet = {
  ownerAddress: string;
  baseMineralsPerDay: bigint | null;
  mintedAt: Date;
};

type Pagination = { offset: number; limit: number };
type LeaderboardDatabase = PrismaClient | Prisma.TransactionClient;

function addToMap(target: Map<string, bigint>, address: string, amount: bigint) {
  const normalizedAddress = address.toLowerCase();
  target.set(normalizedAddress, (target.get(normalizedAddress) ?? 0n) + amount);
}

/** Calculates a daily snapshot directly from immutable Planet traits. */
export function calculateLeaderboardRows(input: {
  period?: LeaderboardPeriodBounds;
  asOf: Date;
  planets: readonly LifetimeLeaderboardPlanet[];
}): RankedLeaderboardRow[] {
  const period = input.period ?? getLeaderboardPeriod(input.asOf);
  const cutoff = new Date(Math.min(input.asOf.getTime(), period.endsAt.getTime()));
  const scoreByWallet = new Map<string, bigint>();
  const rateByWallet = new Map<string, bigint>();

  for (const planet of input.planets) {
    if (
      planet.baseMineralsPerDay === null ||
      planet.ownerAddress.toLowerCase() === ZERO_ADDRESS ||
      planet.mintedAt.getTime() >= cutoff.getTime()
    )
      continue;
    const score = calculateLifetimeMinerals({
      baseMineralsPerDay: planet.baseMineralsPerDay,
      mintedAt: planet.mintedAt,
      asOf: cutoff,
    });
    if (score > 0n) addToMap(scoreByWallet, planet.ownerAddress, score);
    addToMap(rateByWallet, planet.ownerAddress, planet.baseMineralsPerDay * MINERAL_SCALE);
  }

  return rankLeaderboardRows(
    [...scoreByWallet].map(([walletAddress, scoreMicros]) => ({
      walletAddress,
      scoreMicros,
      effectiveMineralsPerDayMicros: rateByWallet.get(walletAddress) ?? 0n,
    })),
  );
}

export function paginateLeaderboardRows(
  rows: readonly RankedLeaderboardRow[],
  pagination: Pagination,
) {
  return {
    total: rows.length,
    offset: pagination.offset,
    limit: pagination.limit,
    rows: rows.slice(pagination.offset, pagination.offset + pagination.limit),
  };
}

type StoredLeaderboardPeriod = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  finalizedAt?: Date | null;
};

async function loadLatestCompletedSnapshot(database: LeaderboardDatabase, now: Date) {
  const period = (await database.leaderboardPeriod.findFirst({
    where: { finalizedAt: { not: null }, endsAt: { lte: now } },
    orderBy: { endsAt: 'desc' },
  })) as StoredLeaderboardPeriod | null;
  if (!period) return undefined;
  const storedRows = await database.leaderboardEntry.findMany({
    where: { periodId: period.id },
    orderBy: { rank: 'asc' },
  });
  const rows: RankedLeaderboardRow[] = storedRows.map((row) => ({
    rank: row.rank,
    walletAddress: row.walletAddress,
    scoreMicros: row.scoreMicros,
    effectiveMineralsPerDayMicros: row.effectiveMineralsPerDayMicros,
  }));
  return { period, asOf: period.finalizedAt ?? period.endsAt, rows };
}

export async function getCurrentLeaderboard(
  prisma: PrismaClient,
  now: Date,
  pagination: Pagination,
) {
  const snapshot = await loadLatestCompletedSnapshot(prisma, now);
  if (!snapshot) {
    const period = getLeaderboardPeriod(now);
    return { period, asOf: now, ...paginateLeaderboardRows([], pagination) };
  }
  return {
    period: snapshot.period,
    asOf: snapshot.asOf,
    ...paginateLeaderboardRows(snapshot.rows, pagination),
  };
}

export async function getWalletLeaderboardPosition(
  prisma: PrismaClient,
  walletAddress: string,
  now: Date,
) {
  const snapshot = await loadLatestCompletedSnapshot(prisma, now);
  const normalizedAddress = walletAddress.toLowerCase();
  if (!snapshot) {
    return {
      period: getLeaderboardPeriod(now),
      asOf: now,
      row: undefined,
      distanceToNextRankMicros: null,
    };
  }
  const row = snapshot.rows.find((entry) => entry.walletAddress === normalizedAddress);
  return {
    period: snapshot.period,
    asOf: snapshot.asOf,
    row,
    distanceToNextRankMicros: row ? getDistanceToNextRank(snapshot.rows, normalizedAddress) : null,
  };
}

export async function finalizeLeaderboardPeriod(
  prisma: PrismaClient,
  period: LeaderboardPeriodBounds,
  finalizedAt: Date,
) {
  return prisma.$transaction(async (transaction) => {
    const transactionWithQueryRaw = transaction as typeof transaction & {
      $queryRaw?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
    };
    if (transactionWithQueryRaw.$queryRaw) {
      // pg_advisory_xact_lock returns PostgreSQL's `void` type. Selecting that
      // value directly makes Prisma fail while decoding the raw query result;
      // keep the transaction-scoped lock but expose only a scalar column.
      await transactionWithQueryRaw.$queryRaw`SELECT 1 AS locked
        FROM (
          SELECT pg_advisory_xact_lock(hashtextextended('megaplanets:leaderboard-finalization', 0)) AS acquired
        ) AS lock_result`;
    }
    const existing = await transaction.leaderboardPeriod.findUnique({ where: { id: period.id } });
    if (existing?.finalizedAt) {
      return transaction.leaderboardEntry.findMany({
        where: { periodId: period.id },
        orderBy: { rank: 'asc' },
      });
    }

    const planets = await transaction.planet.findMany({
      where: {
        ownerAddress: { not: ZERO_ADDRESS },
        baseMineralsPerDay: { not: null },
        mintedAt: { lt: period.endsAt },
      },
      select: { ownerAddress: true, baseMineralsPerDay: true, mintedAt: true },
    });
    const rows = calculateLeaderboardRows({ period, asOf: period.endsAt, planets });
    await transaction.leaderboardPeriod.upsert({
      where: { id: period.id },
      create: { id: period.id, startsAt: period.startsAt, endsAt: period.endsAt, finalizedAt },
      update: { finalizedAt },
    });
    if (rows.length > 0) {
      await transaction.leaderboardEntry.createMany({
        data: rows.map((row) => ({
          periodId: period.id,
          walletAddress: row.walletAddress,
          scoreMicros: row.scoreMicros,
          effectiveMineralsPerDayMicros: row.effectiveMineralsPerDayMicros,
          rank: row.rank,
        })),
        skipDuplicates: true,
      });
    }
    return transaction.leaderboardEntry.findMany({
      where: { periodId: period.id },
      orderBy: { rank: 'asc' },
    });
  });
}

/** Finalizes every completed UTC day in chronological order. */
export async function ensureOverdueLeaderboardPeriodsFinalized(
  prisma: PrismaClient,
  now: Date,
): Promise<void> {
  const [latest, earliestPlanet] = await Promise.all([
    prisma.leaderboardPeriod.findFirst({
      where: { finalizedAt: { not: null }, endsAt: { lte: now } },
      orderBy: { endsAt: 'desc' },
      select: { endsAt: true },
    }),
    prisma.planet.findFirst({
      where: { baseMineralsPerDay: { not: null } },
      orderBy: { mintedAt: 'asc' },
      select: { mintedAt: true },
    }),
  ]);
  if (!latest && !earliestPlanet) return;

  let period = getLeaderboardPeriod(latest?.endsAt ?? earliestPlanet?.mintedAt ?? now);
  let finalizedPeriods = 0;
  while (period.endsAt <= now) {
    await finalizeLeaderboardPeriod(prisma, period, now);
    period = getLeaderboardPeriod(period.endsAt);
    finalizedPeriods += 1;
    if (finalizedPeriods > 3_660)
      throw new Error('Leaderboard finalization backlog exceeds ten years.');
  }
}

export async function listLeaderboardPeriods(prisma: PrismaClient, pagination: Pagination) {
  const [total, periods] = await Promise.all([
    prisma.leaderboardPeriod.count({ where: { finalizedAt: { not: null } } }),
    prisma.leaderboardPeriod.findMany({
      where: { finalizedAt: { not: null } },
      orderBy: { startsAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
  ]);
  return { total, offset: pagination.offset, limit: pagination.limit, periods };
}

export async function getArchivedLeaderboard(
  prisma: PrismaClient,
  periodId: string,
  pagination: Pagination,
) {
  const period = await prisma.leaderboardPeriod.findUnique({ where: { id: periodId } });
  if (!period?.finalizedAt) return undefined;
  const [total, rows] = await Promise.all([
    prisma.leaderboardEntry.count({ where: { periodId } }),
    prisma.leaderboardEntry.findMany({
      where: { periodId },
      orderBy: { rank: 'asc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
  ]);
  return { period, total, offset: pagination.offset, limit: pagination.limit, rows };
}
