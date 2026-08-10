import { describe, expect, it } from 'vitest';
import {
  accrueMinerals,
  getSameTypeBonusBps,
  getSameTypeMultipliers,
  MINERAL_SCALE,
} from './mining';

describe('mining accrual', () => {
  it('mints exactly one fixed-point daily production at the base rate', () => {
    expect(
      accrueMinerals({
        baseMineralsPerDay: 17n,
        multiplierBps: 10_000n,
        elapsedMilliseconds: 86_400_000n,
        remainder: 0n,
      }),
    ).toEqual({ minerals: 17_000_000n, remainder: 0n });
  });

  it('preserves fractional production across consecutive settlement windows', () => {
    const first = accrueMinerals({
      baseMineralsPerDay: 1n,
      multiplierBps: 10_000n,
      elapsedMilliseconds: 28_800_000n,
      remainder: 0n,
    });
    const second = accrueMinerals({
      baseMineralsPerDay: 1n,
      multiplierBps: 10_000n,
      elapsedMilliseconds: 28_800_000n,
      remainder: first.remainder,
    });
    const third = accrueMinerals({
      baseMineralsPerDay: 1n,
      multiplierBps: 10_000n,
      elapsedMilliseconds: 28_800_000n,
      remainder: second.remainder,
    });

    expect(first).toEqual({ minerals: 333_333n, remainder: 288_000_000_000n });
    expect(second).toEqual({ minerals: 333_333n, remainder: 576_000_000_000n });
    expect(third).toEqual({ minerals: 333_334n, remainder: 0n });
  });

  it('assigns the configured same-type production bonus at every threshold', () => {
    expect(getSameTypeBonusBps(1)).toBe(0n);
    expect(getSameTypeBonusBps(2)).toBe(500n);
    expect(getSameTypeBonusBps(3)).toBe(1_000n);
    expect(getSameTypeBonusBps(4)).toBe(1_500n);
    expect(getSameTypeBonusBps(99)).toBe(1_500n);
  });

  it('applies a wallet type bonus only to planets in the matching type group', () => {
    expect(
      getSameTypeMultipliers([
        { planetId: 'volcanic-1', planetType: 'VOLCANIC' },
        { planetId: 'volcanic-2', planetType: 'VOLCANIC' },
        { planetId: 'gaia-1', planetType: 'GAIA' },
      ]),
    ).toEqual({
      'volcanic-1': 10_500n,
      'volcanic-2': 10_500n,
      'gaia-1': 10_000n,
    });
  });

  it('keeps the mineral scale in the public fixed-point contract', () => {
    expect(MINERAL_SCALE).toBe(1_000_000n);
  });
});
