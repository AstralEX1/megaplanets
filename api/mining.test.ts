import { describe, expect, it } from 'vitest';
import { calculateLifetimeMinerals, MINERAL_SCALE } from './mining';

describe('lifetime mining', () => {
  it('calculates intrinsic lifetime production from mint time', () => {
    expect(
      calculateLifetimeMinerals({
        baseMineralsPerDay: 10n,
        mintedAt: new Date('2026-08-10T00:00:00.000Z'),
        asOf: new Date('2026-08-11T12:00:00.000Z'),
      }),
    ).toBe(15_000_000n);
  });

  it('returns zero at mint and rejects timestamps before mint', () => {
    const input = {
      baseMineralsPerDay: 10n,
      mintedAt: new Date('2026-08-10T00:00:00.000Z'),
      asOf: new Date('2026-08-10T00:00:00.000Z'),
    };
    expect(calculateLifetimeMinerals(input)).toBe(0n);
    expect(() =>
      calculateLifetimeMinerals({ ...input, asOf: new Date('2026-08-09T23:59:59.000Z') }),
    ).toThrow('Mining timestamp cannot be before mint time');
  });

  it('keeps the fixed-point mineral scale explicit', () => {
    expect(MINERAL_SCALE).toBe(1_000_000n);
  });
});
