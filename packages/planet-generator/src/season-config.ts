import { deepFreeze } from './immutable';
import { assertBytes32 } from './input';
import type {
  RarityConfig,
  SatelliteDistribution,
  SeasonConfig,
  TerrainMode,
  TypeConfig,
  TypePalette,
  TypeWeightProfile,
} from './types';
import type { HexColor } from './visual-types';

function palette(colors: readonly [HexColor, HexColor, HexColor, ...HexColor[]]): TypePalette {
  return {
    colors,
    coolorsUrl: `https://coolors.co/${colors.map((color) => color.slice(1)).join('-')}`,
  };
}

export const SEASON_1_RARITY_CONFIG = deepFreeze([
  {
    rarity: 'Common',
    weight: 70,
    min: 10,
    max: 39,
    subranges: [
      { min: 10, max: 19, weight: 5 },
      { min: 20, max: 29, weight: 3 },
      { min: 30, max: 39, weight: 2 },
    ],
  },
  {
    rarity: 'Uncommon',
    weight: 20,
    min: 40,
    max: 79,
    subranges: [
      { min: 40, max: 54, weight: 5 },
      { min: 55, max: 69, weight: 3 },
      { min: 70, max: 79, weight: 2 },
    ],
  },
  {
    rarity: 'Epic',
    weight: 9,
    min: 80,
    max: 159,
    subranges: [
      { min: 80, max: 109, weight: 5 },
      { min: 110, max: 139, weight: 3 },
      { min: 140, max: 159, weight: 2 },
    ],
  },
  {
    rarity: 'Legendary',
    weight: 1,
    min: 160,
    max: 320,
    subranges: [
      { min: 160, max: 219, weight: 5 },
      { min: 220, max: 279, weight: 3 },
      { min: 280, max: 320, weight: 2 },
    ],
  },
] as const satisfies readonly RarityConfig[]);

const STANDARD_SATELLITES = [
  { kind: 'none', min: 0, max: 0, weight: 1 },
  { kind: 'one', min: 1, max: 1, weight: 4 },
  { kind: 'moons', min: 2, max: 5, weight: 4 },
  { kind: 'ring', min: 40, max: 80, weight: 1 },
] as const satisfies readonly SatelliteDistribution[];

const NO_RING_SATELLITES = STANDARD_SATELLITES.filter(
  (entry) => entry.kind !== 'ring',
) as readonly SatelliteDistribution[];

const GAS_GIANT_SATELLITES = [
  { kind: 'none', min: 0, max: 0, weight: 1 },
  { kind: 'one', min: 1, max: 1, weight: 2 },
  { kind: 'moons', min: 5, max: 11, weight: 9 },
  { kind: 'ring', min: 40, max: 80, weight: 4 },
] as const satisfies readonly SatelliteDistribution[];

/** Every Type owns every renderer-facing decision in one immutable visual profile. */
export const SEASON_1_TYPES = deepFreeze([
  {
    id: 'nebula',
    publicName: 'Nebula',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#1e1b4b', '#f72585', '#facc15', '#4cc9f0']),
        palette(['#3b0764', '#4cc9f0', '#f59e0b', '#fff7cc']),
        palette(['#240046', '#f72585', '#4361ee', '#fde047']),
      ],
      terrainWeights: [
        { mode: 'simplex', weight: 4 },
        { mode: 'domain-warping', weight: 4 },
        { mode: 'vertical-stripes', weight: 2 },
        { mode: 'horizontal-stripes', weight: 2 },
      ],
      cloudStyle: 'nebula',
      satelliteStyle: 'standard',
      satellites: STANDARD_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 1,
    },
  },
  {
    id: 'desert',
    publicName: 'Desert',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#4a2c1a', '#b45309', '#f59e0b', '#fef3c7']),
        palette(['#5b3417', '#c2410c', '#fbbf24', '#fffbeb']),
        palette(['#422006', '#a16207', '#facc15', '#fef9c3']),
      ],
      terrainWeights: [
        { mode: 'vertical-stripes', weight: 5 },
        { mode: 'ridged', weight: 3 },
        { mode: 'cellular', weight: 2 },
      ],
      cloudStyle: 'standard',
      satelliteStyle: 'standard',
      satellites: STANDARD_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 1,
    },
  },
  {
    id: 'triplex',
    publicName: 'Triplex',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#f72585', '#4361ee', '#facc15']),
        palette(['#00e5ff', '#ff2d95', '#00e5ff']),
        palette(['#f97316', '#2563eb', '#a855f7']),
      ],
      terrainWeights: [{ mode: 'gradation', weight: 1 }],
      cloudStyle: 'standard',
      satelliteStyle: 'standard',
      satellites: STANDARD_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 1,
    },
  },
  {
    id: 'toxic',
    publicName: 'Toxic',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#ff1744', '#00e5ff', '#76ff03']),
        palette(['#7c4dff', '#ffea00', '#00e676']),
        palette(['#ff1744', '#a855f7', '#00e5ff']),
      ],
      terrainWeights: [
        { mode: 'vertical-stripes', weight: 5 },
        { mode: 'horizontal-stripes', weight: 4 },
        { mode: 'domain-warping', weight: 1 },
      ],
      cloudStyle: 'none',
      satelliteStyle: 'standard',
      satellites: STANDARD_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 1,
    },
  },
  {
    id: 'void',
    publicName: 'Void',
    visual: {
      paletteMode: 'original-cavity',
      paletteVariants: [],
      terrainWeights: [
        { mode: 'domain-warping', weight: 5 },
        { mode: 'simplex', weight: 3 },
        { mode: 'ridged', weight: 2 },
      ],
      cloudStyle: 'none',
      satelliteStyle: 'cavity',
      satellites: STANDARD_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 1,
    },
  },
  {
    id: 'gaia',
    publicName: 'Gaia',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#075985', '#0ea5e9', '#16a34a', '#f8fafc']),
        palette(['#0c4a6e', '#0284c7', '#15803d', '#e2e8f0']),
        palette(['#164e63', '#0891b2', '#047857', '#f1f5f9']),
      ],
      terrainWeights: [
        { mode: 'simplex', weight: 4 },
        { mode: 'domain-warping', weight: 3 },
        { mode: 'ocean-currents', weight: 3 },
      ],
      cloudStyle: 'gaia',
      satelliteStyle: 'gray',
      satellites: NO_RING_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 1,
    },
  },
  {
    id: 'volcanic',
    publicName: 'Volcanic',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#1a0700', '#ff5a00', '#ffd60a', '#ff9f1c']),
        palette(['#170606', '#7f1d1d', '#dc2626', '#f97316']),
        palette(['#26110b', '#9a3412', '#ef4444', '#fb923c']),
      ],
      terrainWeights: [
        { mode: 'turbulence', weight: 5 },
        { mode: 'ridged', weight: 3 },
        { mode: 'cratered', weight: 2 },
      ],
      cloudStyle: 'ash',
      satelliteStyle: 'ash',
      satellites: NO_RING_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 0.75,
    },
  },
  {
    id: 'gas-giant',
    publicName: 'Gas Giant',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#5f2f15', '#c96d2d', '#f6c453', '#fef3c7']),
        palette(['#5f4727', '#b8914a', '#e7c873', '#fff1bf']),
        palette(['#061a40', '#0b5ed7', '#38bdf8', '#bfe9ff']),
        palette(['#4a1020', '#c92d5d', '#f472b6', '#ffe4ef']),
      ],
      terrainWeights: [
        { mode: 'banded', weight: 6 },
        { mode: 'horizontal-stripes', weight: 3 },
        { mode: 'turbulence', weight: 1 },
      ],
      cloudStyle: 'gas-giant',
      satelliteStyle: 'gas-giant',
      satellites: GAS_GIANT_SATELLITES,
      diameterMultiplier: 1.3,
      mainLapMultiplier: 1.8,
      minimumMainLapMs: 7_000,
    },
  },
  {
    id: 'rocky',
    publicName: 'Rocky',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#1f2421', '#4a4f49', '#777b75', '#aaa69c']),
        palette(['#171717', '#3f3f46', '#71717a', '#d4d4d8']),
        palette(['#2f2926', '#62564b', '#928374', '#d5c4a1']),
        palette(['#293241', '#5c677d', '#a9bcd0', '#d9e2ec']),
      ],
      terrainWeights: [
        { mode: 'cratered', weight: 5 },
        { mode: 'ridged', weight: 3 },
        { mode: 'cellular', weight: 2 },
      ],
      cloudStyle: 'none',
      satelliteStyle: 'rocky',
      satellites: NO_RING_SATELLITES,
      diameterMultiplier: 0.9,
      mainLapMultiplier: 1,
    },
  },
  {
    id: 'oceanic',
    publicName: 'Oceanic',
    visual: {
      paletteMode: 'variants',
      paletteVariants: [
        palette(['#0047ff', '#009dff', '#00e5ff', '#d9fbff']),
        palette(['#1236d8', '#0077ff', '#21c7ff', '#d6f8ff']),
        palette(['#0054c7', '#00a6ff', '#45e9ff', '#e0ffff']),
        palette(['#1d4ed8', '#0ea5e9', '#00e5ff', '#ecfeff']),
        palette(['#001f9e', '#006dff', '#00c2ff', '#c8f7ff']),
        palette(['#0039a6', '#008cff', '#3ddcff', '#edffff']),
      ],
      terrainWeights: [
        { mode: 'ocean-currents', weight: 5 },
        { mode: 'domain-warping', weight: 5 },
      ],
      cloudStyle: 'oceanic',
      satelliteStyle: 'standard',
      satellites: STANDARD_SATELLITES,
      diameterMultiplier: 1,
      mainLapMultiplier: 1,
    },
  },
] as const satisfies readonly TypeConfig[]);

/**
 * One bonus-ball bucket per Season 1 Type. The matching Type weighs 55%; each other
 * Type weighs 5%. Bonus balls above ten wrap through this ordered list.
 */
export const SEASON_1_TYPE_WEIGHT_PROFILES = deepFreeze(
  SEASON_1_TYPES.map((type, profileIndex) => ({
    id: `bonus-${profileIndex + 1}-${type.id}`,
    weights: SEASON_1_TYPES.map((_, typeIndex) => (typeIndex === profileIndex ? 55 : 5)),
  })) as readonly TypeWeightProfile[],
);

export function createSeason1Config(seasonId: `0x${string}`): SeasonConfig {
  const config: SeasonConfig = {
    seasonId,
    season: 1,
    types: SEASON_1_TYPES,
    typeWeightProfiles: SEASON_1_TYPE_WEIGHT_PROFILES,
    rarity: SEASON_1_RARITY_CONFIG,
  };
  validateSeasonConfig(config);
  return deepFreeze(config);
}

function assertPositiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer.`);
  }
}

function validateRarity(rarity: readonly RarityConfig[]) {
  const expected = [
    { rarity: 'Common', weight: 70, min: 10, max: 39 },
    { rarity: 'Uncommon', weight: 20, min: 40, max: 79 },
    { rarity: 'Epic', weight: 9, min: 80, max: 159 },
    { rarity: 'Legendary', weight: 1, min: 160, max: 320 },
  ] as const satisfies readonly Omit<RarityConfig, 'subranges'>[];
  if (
    rarity.length !== expected.length ||
    rarity.some((entry, index) => {
      const required = expected[index];
      return (
        !required ||
        entry.rarity !== required.rarity ||
        entry.weight !== required.weight ||
        entry.min !== required.min ||
        entry.max !== required.max
      );
    })
  ) {
    throw new RangeError(
      'Season 1 rarity weights and mineral ranges do not match the canonical configuration.',
    );
  }
  for (const entry of rarity) {
    assertPositiveInteger(entry.weight, `${entry.rarity} weight`);
    if (!Number.isInteger(entry.min) || !Number.isInteger(entry.max) || entry.min > entry.max) {
      throw new RangeError(`${entry.rarity} range is invalid.`);
    }
    if (entry.subranges.length === 0) throw new RangeError(`${entry.rarity} must have subranges.`);
    let expectedMinimum = entry.min;
    for (const range of entry.subranges) {
      assertPositiveInteger(range.weight, `${entry.rarity} subrange weight`);
      if (
        !Number.isInteger(range.min) ||
        !Number.isInteger(range.max) ||
        range.min > range.max ||
        range.min < entry.min ||
        range.max > entry.max ||
        range.min !== expectedMinimum
      ) {
        throw new RangeError(
          `${entry.rarity} subranges must cover its range without gaps or overlap.`,
        );
      }
      expectedMinimum = range.max + 1;
    }
    if (expectedMinimum !== entry.max + 1) {
      throw new RangeError(`${entry.rarity} subranges must cover its full mineral range.`);
    }
  }
}

function isTerrainMode(value: string): value is TerrainMode {
  return [
    'simplex',
    'ridged',
    'domain-warping',
    'vertical-stripes',
    'horizontal-stripes',
    'gradation',
    'turbulence',
    'banded',
    'cratered',
    'ocean-currents',
    'cellular',
    'polar-caps',
  ].includes(value);
}

function colorDistance(first: HexColor, second: HexColor): number {
  const channel = (color: HexColor, offset: number) =>
    Number.parseInt(color.slice(offset, offset + 2), 16);
  return Math.hypot(
    channel(first, 1) - channel(second, 1),
    channel(first, 3) - channel(second, 3),
    channel(first, 5) - channel(second, 5),
  );
}

function validatePaletteContrast(colors: readonly HexColor[], label: string) {
  for (let index = 1; index < colors.length; index += 1) {
    const previous = colors[index - 1];
    const current = colors[index];
    if (!previous || !current || colorDistance(previous, current) < 55) {
      throw new RangeError(`${label} must keep adjacent palette colors visually distinct.`);
    }
  }
}

export function validateSeasonConfig(config: SeasonConfig): void {
  assertBytes32(config.seasonId, 'seasonId');
  if (!Number.isSafeInteger(config.season) || config.season < 1 || config.season > 65_535)
    throw new RangeError('season must be a positive uint16 value.');
  if (config.types.length !== 10) throw new RangeError('Season 1 requires exactly ten Types.');
  if (
    new Set(config.types.map((type) => type.id)).size !== 10 ||
    new Set(config.types.map((type) => type.publicName)).size !== 10
  ) {
    throw new RangeError('Type IDs and public names must be unique.');
  }
  for (const type of config.types) {
    if (
      !/^[a-z0-9-]{1,32}$/.test(type.id) ||
      !type.publicName.trim() ||
      type.publicName.length > 64
    )
      throw new RangeError('Every Type needs a safe ID and a public name up to 64 characters.');
    const visual = type.visual;
    if (
      (visual.paletteMode === 'variants' && visual.paletteVariants.length === 0) ||
      (visual.paletteMode === 'original-cavity' && visual.paletteVariants.length !== 0)
    ) {
      throw new RangeError(
        'Type palette mode does not match its deterministic palette configuration.',
      );
    }
    for (const variant of visual.paletteVariants) {
      if (
        variant.colors.length < 3 ||
        variant.colors.length > 16 ||
        !variant.colors.every((color) => /^#[\da-f]{6}$/i.test(color)) ||
        variant.coolorsUrl.length > 256 ||
        !/^https:\/\/coolors\.co\//.test(variant.coolorsUrl)
      ) {
        throw new RangeError('Every Type palette variant needs valid Coolors colors and URL.');
      }
      validatePaletteContrast(variant.colors, `${type.publicName} palette`);
    }
    if (visual.terrainWeights.length === 0 || visual.terrainWeights.length > 12)
      throw new RangeError('Every Type needs between one and twelve terrain weights.');
    for (const terrain of visual.terrainWeights) {
      if (!isTerrainMode(terrain.mode)) throw new RangeError('Type terrain mode is not supported.');
      assertPositiveInteger(terrain.weight, 'terrain weight');
    }
    if (
      !Number.isFinite(visual.diameterMultiplier) ||
      visual.diameterMultiplier < 0.5 ||
      visual.diameterMultiplier > 1.5
    )
      throw new RangeError('Type diameter multiplier is outside the supported range.');
    if (
      !Number.isFinite(visual.mainLapMultiplier) ||
      visual.mainLapMultiplier < 0.5 ||
      visual.mainLapMultiplier > 3
    )
      throw new RangeError('Type rotation multiplier is outside the supported range.');
    if (
      visual.minimumMainLapMs !== undefined &&
      (!Number.isSafeInteger(visual.minimumMainLapMs) ||
        visual.minimumMainLapMs < 1_000 ||
        visual.minimumMainLapMs > 30_000)
    )
      throw new RangeError('Type minimum rotation duration is invalid.');
    if (visual.satellites.length === 0)
      throw new RangeError('Every Type needs a satellite profile.');
    for (const satellite of visual.satellites) {
      assertPositiveInteger(satellite.weight, 'satellite weight');
      if (
        !Number.isSafeInteger(satellite.min) ||
        !Number.isSafeInteger(satellite.max) ||
        satellite.min < 0 ||
        satellite.max < satellite.min ||
        satellite.max > 512
      )
        throw new RangeError('Type satellite count range is invalid.');
    }
  }
  if (config.typeWeightProfiles.length !== config.types.length)
    throw new RangeError('Season 1 requires exactly one Type weight profile per Type.');
  if (
    new Set(config.typeWeightProfiles.map((profile) => profile.id)).size !== config.types.length
  ) {
    throw new RangeError('Type profile IDs must be unique.');
  }
  for (const [profileIndex, profile] of config.typeWeightProfiles.entries()) {
    if (!profile.id.trim() || profile.weights.length !== config.types.length)
      throw new RangeError('Every Type profile must be named and include one weight per Type.');
    if (
      profile.weights.some((weight, typeIndex) => weight !== (typeIndex === profileIndex ? 55 : 5))
    )
      throw new RangeError('Every Type profile must weight its matching Type 55 and all others 5.');
  }
  validateRarity(config.rarity);
}
