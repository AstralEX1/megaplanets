import type { NoiseMode, PaletteType, PlanetRarity } from './types';

export const GENERATOR_VERSION = 1 as const;

export const PALETTE_TYPES = [
  'analogous',
  'complementary',
  'split-complementary',
  'triad',
  'cavity',
  'earth',
] as const satisfies readonly PaletteType[];

const BASE_PALETTE_WEIGHTS = [15, 10, 6, 4, 1, 6] as const;

export const GENERATOR_CONFIG_V1 = Object.freeze({
  version: GENERATOR_VERSION,
  logicalSize: 128,
  outputSize: 512,
  scale: 4,
  frameCount: 144,
  durationMs: 12_000,
  paletteTypes: PALETTE_TYPES,
  basePaletteWeights: BASE_PALETTE_WEIGHTS,
  noiseModes: [
    'simplex',
    'ridged',
    'domain-warping',
    'vertical-stripes',
    'horizontal-stripes',
    'gradation',
  ] as const satisfies readonly NoiseMode[],
  noiseWeights: [
    [3, 1, 2, 1, 2, 2],
    [3, 0, 2, 0, 0, 2],
    [3, 0, 2, 0, 0, 0],
  ] as const,
  planetDiameter: { min: 32, maxExclusive: 64 },
  ordinarySatellites: { min: 1, maxExclusive: 6 },
  ringParticles: { min: 48, maxExclusive: 81 },
  starCount: { min: 22, maxExclusive: 37 },
  rarityWeights: {
    Common: 7_200,
    Uncommon: 2_000,
    Rare: 700,
    Legendary: 99,
    '42': 1,
  } as const satisfies Readonly<Record<PlanetRarity, number>>,
  specialEditionsEnabled: false,
});

/** Bonus ball selects a rotated weight profile; the seed selects within it. */
export function getPaletteWeights(bonusBall: number): readonly number[] {
  if (!Number.isInteger(bonusBall) || bonusBall < 1 || bonusBall > 255) {
    throw new RangeError('bonusBall must be an integer between 1 and 255.');
  }
  const offset = (bonusBall - 1) % BASE_PALETTE_WEIGHTS.length;
  return BASE_PALETTE_WEIGHTS.map(
    (_, index) => BASE_PALETTE_WEIGHTS[(index - offset + BASE_PALETTE_WEIGHTS.length) % 6],
  );
}

export function getPaletteProfile(bonusBall: number): number {
  getPaletteWeights(bonusBall);
  return (bonusBall - 1) % BASE_PALETTE_WEIGHTS.length;
}
