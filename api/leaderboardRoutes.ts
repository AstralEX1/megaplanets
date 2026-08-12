import { Hono } from 'hono';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import { getPrismaClient } from './database';
import type { PrismaClient } from './generated/prisma/client';
import {
  getArchivedLeaderboard,
  getCurrentLeaderboard,
  getWalletLeaderboardPosition,
  listLeaderboardPeriods,
} from './leaderboardStore';
import { loadStage2Config } from './stage2Config';

const paginationSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const periodIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type LeaderboardDependencies = {
  getPrisma: () => PrismaClient;
  now: () => Date;
  getCurrent: typeof getCurrentLeaderboard;
  getWalletPosition: typeof getWalletLeaderboardPosition;
  listPeriods: typeof listLeaderboardPeriods;
  getArchived: typeof getArchivedLeaderboard;
  finalize: (prisma: PrismaClient, now: Date) => Promise<void>;
  finalizationToken?: string;
};

const defaultDependencies: LeaderboardDependencies = {
  getPrisma: () => getPrismaClient(loadStage2Config(process.env).databaseUrl),
  now: () => new Date(),
  getCurrent: getCurrentLeaderboard,
  getWalletPosition: getWalletLeaderboardPosition,
  listPeriods: listLeaderboardPeriods,
  getArchived: getArchivedLeaderboard,
  finalize: async () => undefined,
  finalizationToken: process.env.MEGAPLANETS_WORKER_TOKEN?.trim() || undefined,
};

function parsePagination(query: (name: string) => string | undefined) {
  return paginationSchema.safeParse({ offset: query('offset') ?? 0, limit: query('limit') ?? 50 });
}

function serializePeriod(period: { id: string; startsAt: Date; endsAt: Date; finalizedAt?: Date | null }) {
  return {
    id: period.id,
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
    ...(period.finalizedAt === undefined ? {} : { finalizedAt: period.finalizedAt?.toISOString() ?? null }),
  };
}

function serializeRow(row: {
  rank: number;
  walletAddress: string;
  scoreMicros: bigint;
  effectiveMineralsPerDayMicros: bigint;
}) {
  return {
    rank: row.rank,
    walletAddress: row.walletAddress,
    scoreMicros: row.scoreMicros.toString(),
    effectiveMineralsPerDayMicros: row.effectiveMineralsPerDayMicros.toString(),
  };
}

export function createLeaderboardRoutes(overrides: Partial<LeaderboardDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono();

  app.get('/current', async (c) => {
    const pagination = parsePagination((name) => c.req.query(name));
    if (!pagination.success) return c.json({ error: 'offset and limit must be bounded integers.' }, 400);
    try {
      const prisma = dependencies.getPrisma();
      const now = dependencies.now();
      const result = await dependencies.getCurrent(prisma, now, pagination.data);
      return c.json({
        period: serializePeriod(result.period),
        asOf: result.asOf.toISOString(),
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        rows: result.rows.map(serializeRow),
      });
    } catch {
      return c.json({ error: 'The leaderboard API is not configured.' }, 503);
    }
  });

  app.get('/current/:address', async (c) => {
    const address = c.req.param('address');
    if (!isAddress(address)) return c.json({ error: 'A valid wallet address is required.' }, 400);
    try {
      const prisma = dependencies.getPrisma();
      const now = dependencies.now();
      const result = await dependencies.getWalletPosition(
        prisma,
        getAddress(address).toLowerCase(),
        now,
      );
      return c.json({
        period: serializePeriod(result.period),
        asOf: result.asOf.toISOString(),
        row: result.row ? serializeRow(result.row) : null,
        distanceToNextRankMicros: result.distanceToNextRankMicros,
      });
    } catch {
      return c.json({ error: 'The leaderboard API is not configured.' }, 503);
    }
  });

  app.get('/history', async (c) => {
    const pagination = parsePagination((name) => c.req.query(name));
    if (!pagination.success) return c.json({ error: 'offset and limit must be bounded integers.' }, 400);
    try {
      const prisma = dependencies.getPrisma();
      const result = await dependencies.listPeriods(prisma, pagination.data);
      return c.json({ ...result, periods: result.periods.map(serializePeriod) });
    } catch {
      return c.json({ error: 'The leaderboard API is not configured.' }, 503);
    }
  });

  app.get('/weeks/:periodId', async (c) => {
    const periodId = periodIdSchema.safeParse(c.req.param('periodId'));
    const pagination = parsePagination((name) => c.req.query(name));
    if (!periodId.success || !pagination.success) return c.json({ error: 'A valid period ID and pagination are required.' }, 400);
    try {
      const prisma = dependencies.getPrisma();
      const result = await dependencies.getArchived(prisma, periodId.data, pagination.data);
      if (!result) return c.json({ error: 'Leaderboard period not found.' }, 404);
      return c.json({
        period: serializePeriod(result.period),
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        rows: result.rows.map(serializeRow),
      });
    } catch {
      return c.json({ error: 'The leaderboard API is not configured.' }, 503);
    }
  });

  app.post('/finalize', async (c) => {
    if (!dependencies.finalizationToken) return c.json({ error: 'Leaderboard worker is not configured.' }, 503);
    if (c.req.header('authorization') !== `Bearer ${dependencies.finalizationToken}`) {
      return c.json({ error: 'Leaderboard worker authentication is required.' }, 401);
    }
    try {
      await dependencies.finalize(dependencies.getPrisma(), dependencies.now());
      return c.json({ ok: true });
    } catch {
      return c.json({ error: 'Leaderboard finalization failed.' }, 503);
    }
  });

  return app;
}
