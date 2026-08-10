export const MINERAL_SCALE = 1_000_000n;

const BASIS_POINTS = 10_000n;
const MILLISECONDS_PER_DAY = 86_400_000n;

export type MiningAccrualInput = {
  baseMineralsPerDay: bigint;
  multiplierBps: bigint;
  elapsedMilliseconds: bigint;
  remainder: bigint;
};

export type MiningAccrual = {
  minerals: bigint;
  remainder: bigint;
};

export type PlanetTypeMember = {
  planetId: string;
  planetType: string;
};

function assertNonNegative(name: string, value: bigint) {
  if (value < 0n) throw new Error(`${name} cannot be negative.`);
}

/** Converts an elapsed production interval into microminerals without losing fractions. */
export function accrueMinerals(input: MiningAccrualInput): MiningAccrual {
  assertNonNegative('baseMineralsPerDay', input.baseMineralsPerDay);
  assertNonNegative('multiplierBps', input.multiplierBps);
  assertNonNegative('elapsedMilliseconds', input.elapsedMilliseconds);
  assertNonNegative('remainder', input.remainder);

  const denominator = MILLISECONDS_PER_DAY * BASIS_POINTS;
  if (input.remainder >= denominator) throw new Error('remainder must be smaller than one mining denominator.');
  const numerator = input.baseMineralsPerDay * MINERAL_SCALE * input.multiplierBps * input.elapsedMilliseconds + input.remainder;
  return { minerals: numerator / denominator, remainder: numerator % denominator };
}

/** Returns the MVP same-type production bonus in basis points. */
export function getSameTypeBonusBps(planetCount: number): bigint {
  if (!Number.isSafeInteger(planetCount) || planetCount < 1) {
    throw new Error('planetCount must be a positive safe integer.');
  }
  if (planetCount >= 4) return 1_500n;
  if (planetCount === 3) return 1_000n;
  if (planetCount === 2) return 500n;
  return 0n;
}

/** Assigns each planet its base multiplier plus the current wallet same-type bonus. */
export function getSameTypeMultipliers(members: readonly PlanetTypeMember[]): Record<string, bigint> {
  const counts = new Map<string, number>();
  const result: Record<string, bigint> = {};
  for (const member of members) {
    if (!member.planetId.trim() || !member.planetType.trim()) throw new Error('Planet ID and type are required for mining.');
    if (member.planetId in result) throw new Error(`Duplicate Planet ID ${member.planetId}.`);
    counts.set(member.planetType, (counts.get(member.planetType) ?? 0) + 1);
  }
  for (const member of members) {
    result[member.planetId] = BASIS_POINTS + getSameTypeBonusBps(counts.get(member.planetType) ?? 0);
  }
  return result;
}
