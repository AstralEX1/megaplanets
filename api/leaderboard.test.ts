import { describe, expect, it } from 'vitest';
import { getDistanceToNextRank, getLeaderboardPeriod, rankLeaderboardRows } from './leaderboard';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const ADDRESS_C = '0x3333333333333333333333333333333333333333';

describe('daily leaderboard periods', () => {
  it('uses UTC calendar-day boundaries in the middle of a day', () => {
    expect(getLeaderboardPeriod(new Date('2026-08-12T12:00:00.000Z'))).toEqual({
      id: '2026-08-12',
      startsAt: new Date('2026-08-12T00:00:00.000Z'),
      endsAt: new Date('2026-08-13T00:00:00.000Z'),
    });
  });

  it('starts a new period at the exact UTC midnight boundary', () => {
    expect(getLeaderboardPeriod(new Date('2026-08-17T00:00:00.000Z'))).toEqual({
      id: '2026-08-17',
      startsAt: new Date('2026-08-17T00:00:00.000Z'),
      endsAt: new Date('2026-08-18T00:00:00.000Z'),
    });
  });
});

describe('daily leaderboard ranking', () => {
  it('sorts score descending and resolves ties by normalized wallet address', () => {
    expect(
      rankLeaderboardRows([
        {
          walletAddress: ADDRESS_B.toUpperCase(),
          scoreMicros: 10n,
          effectiveMineralsPerDayMicros: 2n,
        },
        { walletAddress: ADDRESS_C, scoreMicros: 20n, effectiveMineralsPerDayMicros: 3n },
        { walletAddress: ADDRESS_A, scoreMicros: 10n, effectiveMineralsPerDayMicros: 1n },
      ]),
    ).toEqual([
      { rank: 1, walletAddress: ADDRESS_C, scoreMicros: 20n, effectiveMineralsPerDayMicros: 3n },
      { rank: 2, walletAddress: ADDRESS_A, scoreMicros: 10n, effectiveMineralsPerDayMicros: 1n },
      { rank: 3, walletAddress: ADDRESS_B, scoreMicros: 10n, effectiveMineralsPerDayMicros: 2n },
    ]);
  });

  it('returns the score needed to reach the preceding rank', () => {
    const rows = rankLeaderboardRows([
      { walletAddress: ADDRESS_A, scoreMicros: 25n, effectiveMineralsPerDayMicros: 1n },
      { walletAddress: ADDRESS_B, scoreMicros: 19n, effectiveMineralsPerDayMicros: 1n },
      { walletAddress: ADDRESS_C, scoreMicros: 4n, effectiveMineralsPerDayMicros: 1n },
    ]);

    expect(getDistanceToNextRank(rows, ADDRESS_A)).toBeNull();
    expect(getDistanceToNextRank(rows, ADDRESS_B)).toBe('6');
    expect(getDistanceToNextRank(rows, ADDRESS_C)).toBe('15');
  });
});
