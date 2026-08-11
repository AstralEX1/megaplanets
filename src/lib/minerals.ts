const MINERAL_SCALE = 1_000_000n;
const MILLISECONDS_PER_DAY = 86_400_000n;

export function formatMinerals(micros: bigint, maximumFractionDigits = 2): string {
  if (micros < 0n) throw new Error('Mineral score cannot be negative.');
  const whole = micros / MINERAL_SCALE;
  const groupedWhole = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (maximumFractionDigits <= 0) return groupedWhole;
  const fraction = (micros % MINERAL_SCALE)
    .toString()
    .padStart(6, '0')
    .slice(0, Math.min(maximumFractionDigits, 6))
    .replace(/0+$/, '');
  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
}

export function interpolateMinerals(input: {
  snapshotMicros: bigint;
  effectiveMineralsPerDayMicros: bigint;
  asOf: Date;
  now: Date;
}): bigint {
  const elapsedMilliseconds = Math.max(0, input.now.getTime() - input.asOf.getTime());
  return input.snapshotMicros
    + input.effectiveMineralsPerDayMicros * BigInt(elapsedMilliseconds) / MILLISECONDS_PER_DAY;
}
