import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';
import { createDailySnapshot, scoreWalletHoldings, type PlanetHolding } from './scoring';

const alice = '0x1111111111111111111111111111111111111111' as const;
const bob = '0x2222222222222222222222222222222222222222' as const;

function holding(tokenId: bigint, holder: Address = alice, planetType = 'Nebula', minerals = 10n): PlanetHolding {
  return { tokenId, holder, planetType, minerals };
}

describe('daily Planet scoring', () => {
  it('applies the Type multiplier before the diversity multiplier', () => {
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
    expect(() => createDailySnapshot({
      blockNumber: 50_000_000n,
      capturedAt: '2026-08-03T12:00:00.000Z',
      holdings: [holding(1n), holding(1n, bob)],
    })).toThrow('Duplicate Planet token ID 1');
  });
});
