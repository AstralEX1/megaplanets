import type { Address } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  createDailySnapshot,
  createLifetimeDailySnapshot,
  getUtcDayBounds,
  type PlanetHolding,
  scoreWalletHoldings,
} from './scoring';

const alice = '0x1111111111111111111111111111111111111111' as const;
const bob = '0x2222222222222222222222222222222222222222' as const;

function holding(
  tokenId: bigint,
  holder: Address = alice,
  planetType = 'Nebula',
  minerals = 10n,
): PlanetHolding {
  return { tokenId, holder, planetType, minerals };
}

describe('legacy block snapshot scoring compatibility', () => {
  it('keeps UTC midnight as the daily snapshot boundary', () => {
    expect(getUtcDayBounds(new Date('2026-08-03T23:59:59.999Z'))).toEqual({
      id: '2026-08-03',
      startsAt: new Date('2026-08-03T00:00:00.000Z'),
      endsAt: new Date('2026-08-04T00:00:00.000Z'),
    });
    expect(getUtcDayBounds(new Date('2026-08-04T00:00:00.000Z')).id).toBe('2026-08-04');
  });

  it('builds a deterministic UTC daily snapshot from immutable Planet mint times', () => {
    const snapshot = createLifetimeDailySnapshot({
      blockNumber: 50_000_000n,
      capturedAt: '2026-08-03T00:00:00.000Z',
      asOf: new Date('2026-08-03T00:00:00.000Z'),
      planets: [
        {
          tokenId: 2n,
          holder: bob,
          planetType: 'Oceanic',
          baseMineralsPerDay: 10n,
          mintedAt: new Date('2026-08-01T00:00:00.000Z'),
        },
      ],
    });

    expect(snapshot.holdings).toEqual([
      {
        tokenId: 2n,
        holder: bob,
        planetType: 'Oceanic',
        minerals: 20_000_000n,
      },
    ]);
    expect(snapshot.capturedAt).toBe('2026-08-03T00:00:00.000Z');
  });

  it('preserves historical Type and diversity multipliers for old snapshots', () => {
    const score = scoreWalletHoldings(alice, [
      holding(3n, alice, 'Nebula', 10n),
      holding(1n, alice, 'Nebula', 10n),
      holding(2n, alice, 'Nebula', 10n),
      holding(4n, alice, 'Oceanic', 100n),
    ]);

    expect(score.tokenIds).toEqual([1n, 2n, 3n, 4n]);
    expect(score.typeScores).toEqual([
      { planetType: 'Nebula', tokenCount: 3, minerals: 30n, multiplierBps: 11_500n, score: 34n },
      { planetType: 'Oceanic', tokenCount: 1, minerals: 100n, multiplierBps: 10_000n, score: 100n },
    ]);
    expect(score.diversityMultiplierBps).toBe(10_100n);
    expect(score.score).toBe(135n);
  });

  it('sorts wallets deterministically and rejects duplicate token IDs', () => {
    const snapshot = createDailySnapshot({
      blockNumber: 50_000_000n,
      capturedAt: '2026-08-03T12:00:00.000Z',
      holdings: [holding(2n, bob), holding(1n, alice)],
    });

    expect(snapshot.wallets.map((wallet) => wallet.holder)).toEqual([alice, bob]);
    expect(() =>
      createDailySnapshot({
        blockNumber: 50_000_000n,
        capturedAt: '2026-08-03T12:00:00.000Z',
        holdings: [holding(1n), holding(1n, bob)],
      }),
    ).toThrow('Duplicate Planet token ID 1');
  });
});
