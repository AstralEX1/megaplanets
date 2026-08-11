import { describe, expect, it } from 'vitest';
import { createLeaderboardRoutes } from './leaderboardRoutes';

const ADDRESS = '0x1111111111111111111111111111111111111111';
const period = {
  id: '2026-08-10',
  startsAt: new Date('2026-08-10T00:00:00.000Z'),
  endsAt: new Date('2026-08-17T00:00:00.000Z'),
};

describe('leaderboard routes', () => {
  it('serializes current bigint standings as decimal strings', async () => {
    let finalizationChecks = 0;
    const app = createLeaderboardRoutes({
      getPrisma: () => ({}) as never,
      now: () => new Date('2026-08-12T12:00:00.000Z'),
      ensureFinalized: async () => { finalizationChecks += 1; },
      getCurrent: async () => ({
        period,
        asOf: new Date('2026-08-12T12:00:00.000Z'),
        total: 1,
        offset: 0,
        limit: 50,
        rows: [{ rank: 1, walletAddress: ADDRESS, scoreMicros: 12_345_678n, effectiveMineralsPerDayMicros: 2_000_000n }],
      }),
    });

    const response = await app.request('/current');

    expect(response.status).toBe(200);
    expect(finalizationChecks).toBe(1);
    expect(await response.json()).toEqual({
      period: { id: '2026-08-10', startsAt: '2026-08-10T00:00:00.000Z', endsAt: '2026-08-17T00:00:00.000Z' },
      asOf: '2026-08-12T12:00:00.000Z',
      total: 1,
      offset: 0,
      limit: 50,
      rows: [{ rank: 1, walletAddress: ADDRESS, scoreMicros: '12345678', effectiveMineralsPerDayMicros: '2000000' }],
    });
  });

  it('returns a wallet position and validates public query parameters', async () => {
    const app = createLeaderboardRoutes({
      getPrisma: () => ({}) as never,
      ensureFinalized: async () => undefined,
      getWalletPosition: async (_prisma, address) => ({
        period,
        asOf: new Date('2026-08-12T12:00:00.000Z'),
        row: { rank: 2, walletAddress: address.toLowerCase(), scoreMicros: 9n, effectiveMineralsPerDayMicros: 3n },
        distanceToNextRankMicros: '4',
      }),
    });

    expect((await app.request('/current/not-an-address')).status).toBe(400);
    expect((await app.request('/current?limit=101')).status).toBe(400);
    const response = await app.request(`/current/${ADDRESS}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      row: { rank: 2, scoreMicros: '9' },
      distanceToNextRankMicros: '4',
    });
  });
});
