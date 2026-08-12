export const MINERAL_SCALE = 1_000_000n;

const MILLISECONDS_PER_DAY = 86_400_000n;

export type LifetimeMiningInput = {
  baseMineralsPerDay: bigint;
  mintedAt: Date;
  asOf: Date;
};

function assertNonNegative(name: string, value: bigint) {
  if (value < 0n) throw new Error(`${name} cannot be negative.`);
}

/** Calculates immutable lifetime production from the mint timestamp. */
export function calculateLifetimeMinerals(input: LifetimeMiningInput): bigint {
  assertNonNegative('baseMineralsPerDay', input.baseMineralsPerDay);
  const elapsed = input.asOf.getTime() - input.mintedAt.getTime();
  if (elapsed < 0) throw new Error('Mining timestamp cannot be before mint time.');
  return (
    input.baseMineralsPerDay * MINERAL_SCALE * BigInt(elapsed)
  ) / MILLISECONDS_PER_DAY;
}
