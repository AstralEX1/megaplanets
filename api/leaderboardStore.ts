import type { Prisma, PrismaClient } from './generated/prisma/client';
import {
  getDistanceToNextRank,
  getLeaderboardPeriod,
  rankLeaderboardRows,
  type LeaderboardPeriodBounds,
  type RankedLeaderboardRow,
} from './leaderboard';
import { accrueMinerals, accrueMineralsForOverlap, MINERAL_SCALE } from './mining';

const BASIS_POINTS = 10_000n;

type LedgerSegment = {
  ownerAddress: string;
  startedAt: Date;
  endedAt: Date;
  baseMineralsPerDay: bigint;
  multiplierBps: number;
  amountMicros: bigint;
};

type ActiveSegment = {
  ownerAddress: string;
  startedAt: Date;
  multiplierBps: number;
  remainder: bigint;
  planet: { baseMineralsPerDay: bigint | null };
};

type Pagination = { offset: number; limit: number };
type LeaderboardDatabase = PrismaClient | Prisma.TransactionClient;

function addToMap(target: Map<string, bigint>, address: string, amount: bigint) {
  const normalizedAddress = address.toLowerCase();
  target.set(normalizedAddress, (target.get(normalizedAddress) ?? 0n) + amount);
}

export function calculateLeaderboardRows(input: {
  period: LeaderboardPeriodBounds;
  asOf: Date;
  ledger: readonly LedgerSegment[];
  active: readonly ActiveSegment[];
}): RankedLeaderboardRow[] {
  const scoreByWallet = new Map<string, bigint>();
  const rateByWallet = new Map<string, bigint>();
  const cutoff = new Date(Math.min(input.asOf.getTime(), input.period.endsAt.getTime()));

  for (const segment of input.ledger) {
    const fullyInsidePeriod = segment.startedAt >= input.period.startsAt && segment.endedAt <= input.period.endsAt;
    const amount = fullyInsidePeriod
      ? segment.amountMicros
      : accrueMineralsForOverlap({
        baseMineralsPerDay: segment.baseMineralsPerDay,
        multiplierBps: BigInt(segment.multiplierBps),
        startedAt: segment.startedAt,
        endedAt: segment.endedAt,
      }, input.period.startsAt, cutoff);
    if (amount > 0n) addToMap(scoreByWallet, segment.ownerAddress, amount);
  }

  for (const segment of input.active) {
    if (segment.planet.baseMineralsPerDay === null || segment.startedAt >= cutoff) continue;
    const startsInsidePeriod = segment.startedAt >= input.period.startsAt;
    const pending = startsInsidePeriod
      ? accrueMinerals({
        baseMineralsPerDay: segment.planet.baseMineralsPerDay,
        multiplierBps: BigInt(segment.multiplierBps),
        elapsedMilliseconds: BigInt(cutoff.getTime() - segment.startedAt.getTime()),
        remainder: segment.remainder,
      }).minerals
      : accrueMineralsForOverlap({
        baseMineralsPerDay: segment.planet.baseMineralsPerDay,
        multiplierBps: BigInt(segment.multiplierBps),
        startedAt: segment.startedAt,
        endedAt: cutoff,
      }, input.period.startsAt, cutoff);
    addToMap(scoreByWallet, segment.ownerAddress, pending);
    if (input.asOf < input.period.endsAt) {
      addToMap(
        rateByWallet,
        segment.ownerAddress,
        segment.planet.baseMineralsPerDay * MINERAL_SCALE * BigInt(segment.multiplierBps) / BASIS_POINTS,
      );
    }
  }

  return rankLeaderboardRows([...scoreByWallet].map(([walletAddress, scoreMicros]) => ({
    walletAddress,
    scoreMicros,
    effectiveMineralsPerDayMicros: rateByWallet.get(walletAddress) ?? 0n,
  })));
}

export function paginateLeaderboardRows(rows: readonly RankedLeaderboardRow[], pagination: Pagination) {
  return {
    total: rows.length,
    offset: pagination.offset,
    limit: pagination.limit,
    rows: rows.slice(pagination.offset, pagination.offset + pagination.limit),
  };
}

async function loadLiveRows(
  database: LeaderboardDatabase,
  period: LeaderboardPeriodBounds,
  asOf: Date,
): Promise<RankedLeaderboardRow[]> {
  const cutoff = new Date(Math.min(asOf.getTime(), period.endsAt.getTime()));
  const [ledger, active] = await Promise.all([
    database.mineralLedgerEntry.findMany({
      where: { startedAt: { lt: cutoff }, endedAt: { gt: period.startsAt } },
      select: {
        ownerAddress: true,
        startedAt: true,
        endedAt: true,
        baseMineralsPerDay: true,
        multiplierBps: true,
        amountMicros: true,
      },
    }),
    database.planetAccrualState.findMany({
      where: { startedAt: { lt: cutoff }, planet: { baseMineralsPerDay: { not: null } } },
      select: {
        ownerAddress: true,
        startedAt: true,
        multiplierBps: true,
        remainder: true,
        planet: { select: { baseMineralsPerDay: true } },
      },
    }),
  ]);
  return calculateLeaderboardRows({ period, asOf, ledger, active });
}

export async function getCurrentLeaderboard(
  prisma: PrismaClient,
  now: Date,
  pagination: Pagination,
) {
  const period = getLeaderboardPeriod(now);
  const rows = await loadLiveRows(prisma, period, now);
  return { period, asOf: now, ...paginateLeaderboardRows(rows, pagination) };
}

export async function getWalletLeaderboardPosition(prisma: PrismaClient, walletAddress: string, now: Date) {
  const period = getLeaderboardPeriod(now);
  const rows = await loadLiveRows(prisma, period, now);
  const normalizedAddress = walletAddress.toLowerCase();
  const row = rows.find((entry) => entry.walletAddress === normalizedAddress);
  return {
    period,
    asOf: now,
    row,
    distanceToNextRankMicros: row ? getDistanceToNextRank(rows, normalizedAddress) : null,
  };
}

async function settleActiveSegmentsAtBoundary(transaction: Prisma.TransactionClient, boundary: Date) {
  const states = await transaction.planetAccrualState.findMany({
    where: { startedAt: { lt: boundary }, planet: { baseMineralsPerDay: { not: null } } },
    select: {
      id: true,
      planetId: true,
      ownerAddress: true,
      startedAt: true,
      multiplierBps: true,
      remainder: true,
      planet: { select: { baseMineralsPerDay: true } },
    },
  });
  for (const state of states) {
    if (state.planet.baseMineralsPerDay === null) continue;
    const accrued = accrueMinerals({
      baseMineralsPerDay: state.planet.baseMineralsPerDay,
      multiplierBps: BigInt(state.multiplierBps),
      elapsedMilliseconds: BigInt(boundary.getTime() - state.startedAt.getTime()),
      remainder: state.remainder,
    });
    await transaction.mineralLedgerEntry.create({
      data: {
        planetId: state.planetId,
        ownerAddress: state.ownerAddress,
        startedAt: state.startedAt,
        endedAt: boundary,
        baseMineralsPerDay: state.planet.baseMineralsPerDay,
        multiplierBps: state.multiplierBps,
        amountMicros: accrued.minerals,
        fractionalRemainder: accrued.remainder,
      },
    });
    await transaction.planetAccrualState.update({
      where: { id: state.id },
      data: { startedAt: boundary, remainder: accrued.remainder },
    });
  }
}

export async function finalizeLeaderboardPeriod(
  prisma: PrismaClient,
  period: LeaderboardPeriodBounds,
  finalizedAt: Date,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('megaplanets:leaderboard-finalization', 0))`;
    const existing = await transaction.leaderboardPeriod.findUnique({ where: { id: period.id } });
    if (existing?.finalizedAt) {
      return transaction.leaderboardEntry.findMany({ where: { periodId: period.id }, orderBy: { rank: 'asc' } });
    }
    await settleActiveSegmentsAtBoundary(transaction, period.endsAt);
    const rows = await loadLiveRows(transaction, period, period.endsAt);
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
    return transaction.leaderboardEntry.findMany({ where: { periodId: period.id }, orderBy: { rank: 'asc' } });
  });
}

/** Finalizes every completed UTC week in chronological order. */
export async function ensureOverdueLeaderboardPeriodsFinalized(prisma: PrismaClient, now: Date): Promise<void> {
  const [latest, earliestLedger, earliestActive] = await Promise.all([
    prisma.leaderboardPeriod.findFirst({
      where: { finalizedAt: { not: null } },
      orderBy: { endsAt: 'desc' },
      select: { endsAt: true },
    }),
    prisma.mineralLedgerEntry.aggregate({ _min: { startedAt: true } }),
    prisma.planetAccrualState.aggregate({ _min: { startedAt: true } }),
  ]);
  const candidates = [earliestLedger._min.startedAt, earliestActive._min.startedAt].filter((date): date is Date => date instanceof Date);
  const firstMiningAt = candidates.sort((left, right) => left.getTime() - right.getTime())[0];
  if (!latest && !firstMiningAt) return;

  let period = getLeaderboardPeriod(latest?.endsAt ?? firstMiningAt);
  let finalizedPeriods = 0;
  while (period.endsAt <= now) {
    await finalizeLeaderboardPeriod(prisma, period, now);
    period = getLeaderboardPeriod(period.endsAt);
    finalizedPeriods += 1;
    if (finalizedPeriods > 520) throw new Error('Leaderboard finalization backlog exceeds ten years.');
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

export async function getArchivedLeaderboard(prisma: PrismaClient, periodId: string, pagination: Pagination) {
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
