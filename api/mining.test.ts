import { describe, expect, it } from 'vitest';
import {
  accrueMineralsForOverlap,
  accrueMinerals,
  getSameTypeBonusBps,
  getSameTypeMultipliers,
  MINERAL_SCALE,
} from './mining';

describe('mining accrual', () => {
  it('counts only the part of a production segment inside the requested period', () => {
    expect(accrueMineralsForOverlap({
      baseMineralsPerDay: 10n,
      multiplierBps: 10_000n,
      startedAt: new Date('2026-08-09T12:00:00.000Z'),
      endedAt: new Date('2026-08-10T12:00:00.000Z'),
    }, new Date('2026-08-10T00:00:00.000Z'), new Date('2026-08-17T00:00:00.000Z'))).toBe(5_000_000n);
  });

  it('returns zero for a production segment outside the requested period', () => {
    expect(accrueMineralsForOverlap({
      baseMineralsPerDay: 10n,
      multiplierBps: 10_000n,
      startedAt: new Date('2026-08-01T00:00:00.000Z'),
      endedAt: new Date('2026-08-02T00:00:00.000Z'),
    }, new Date('2026-08-10T00:00:00.000Z'), new Date('2026-08-17T00:00:00.000Z'))).toBe(0n);
  });

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
