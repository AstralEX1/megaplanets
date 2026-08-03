import { deepFreeze } from './immutable';
import { assertBytes32 } from './input';
import type {
  RarityConfig,
  SeasonConfig,
  TerrainMode,
  TypeConfig,
  TypeWeightProfile,
} from './types';

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

/**
 * The first six Type concepts are renamed for Season 1; the final four are the
 * user-approved Volcanic, Gas Giant, Rocky, and Oceanic families. Every palette is
 * based on the linked Coolors palette and remains a declarative renderer input.
 */
export const SEASON_1_TYPES = deepFreeze([
  {
    id: 'nebula',
    publicName: 'Nebula',
    palette: {
      colors: ['#4c1d95', '#7c3aed', '#a78bfa', '#ddd6fe'],
      coolorsUrl: 'https://coolors.co/4c1d95-7c3aed-a78bfa-ddd6fe',
    },
    terrainWeights: [
      { mode: 'simplex', weight: 4 },
      { mode: 'domain-warping', weight: 4 },
      { mode: 'vertical-stripes', weight: 2 },
      { mode: 'horizontal-stripes', weight: 2 },
    ],
  },
  {
    id: 'desert',
    publicName: 'Desert',
    palette: {
      colors: ['#4a2c1a', '#b45309', '#f59e0b', '#fef3c7', '#fffbeb'],
      coolorsUrl: 'https://coolors.co/4a2c1a-b45309-f59e0b-fef3c7-fffbeb',
    },
    terrainWeights: [
      { mode: 'vertical-stripes', weight: 5 },
      { mode: 'ridged', weight: 3 },
      { mode: 'cellular', weight: 2 },
    ],
  },
  {
    id: 'triplex',
    publicName: 'Triplex',
    palette: {
      colors: ['#f72585', '#4361ee', '#facc15'],
      coolorsUrl: 'https://coolors.co/f72585-4361ee-facc15',
    },
    terrainWeights: [{ mode: 'gradation', weight: 1 }],
  },
  {
    id: 'toxic',
    publicName: 'Toxic',
    palette: {
      colors: ['#ff1744', '#00e5ff', '#76ff03', '#a855f7', '#ffea00'],
      coolorsUrl: 'https://coolors.co/ff1744-00e5ff-76ff03-a855f7-ffea00',
    },
    terrainWeights: [
      { mode: 'vertical-stripes', weight: 5 },
      { mode: 'horizontal-stripes', weight: 4 },
      { mode: 'domain-warping', weight: 1 },
    ],
  },
  {
    id: 'void',
    publicName: 'Void',
    palette: {
      colors: ['#0f172a', '#7c3aed', '#22d3ee'],
      coolorsUrl: 'https://coolors.co/0f172a-7c3aed-22d3ee',
    },
    terrainWeights: [
      { mode: 'domain-warping', weight: 5 },
      { mode: 'cellular', weight: 3 },
      { mode: 'simplex', weight: 2 },
    ],
  },
  {
    id: 'gaia',
    publicName: 'Gaia',
    palette: {
      colors: ['#0077b6', '#00b4d8', '#90e0ef', '#48cae4', '#2d6a4f'],
      coolorsUrl: 'https://coolors.co/0077b6-00b4d8-90e0ef-48cae4-2d6a4f',
    },
    terrainWeights: [
      { mode: 'simplex', weight: 4 },
      { mode: 'domain-warping', weight: 3 },
      { mode: 'ocean-currents', weight: 3 },
    ],
  },
  {
    id: 'volcanic',
    publicName: 'Volcanic',
    palette: {
      colors: ['#1a0a0a', '#9d0208', '#f04a00', '#ff9f1c', '#ffe66d'],
      coolorsUrl: 'https://coolors.co/1a0a0a-9d0208-f04a00-ff9f1c-ffe66d',
    },
    terrainWeights: [
      { mode: 'turbulence', weight: 5 },
      { mode: 'ridged', weight: 3 },
      { mode: 'cratered', weight: 2 },
    ],
  },
  {
    id: 'gas-giant',
    publicName: 'Gas Giant',
    palette: {
      colors: ['#2a383c', '#db6423', '#f2b134', '#e6e6e6', '#1a1a1a'],
      coolorsUrl: 'https://coolors.co/2a383c-db6423-f2b134-e6e6e6-1a1a1a',
    },
    terrainWeights: [
      { mode: 'banded', weight: 6 },
      { mode: 'horizontal-stripes', weight: 3 },
      { mode: 'turbulence', weight: 1 },
    ],
  },
  {
    id: 'rocky',
    publicName: 'Rocky',
    palette: {
      colors: ['#3a606e', '#6e6362', '#bfb8ad', '#e7e5df', '#839073'],
      coolorsUrl: 'https://coolors.co/3a606e-e7e5df-bfb8ad-6e6362-839073',
    },
    terrainWeights: [
      { mode: 'cratered', weight: 5 },
      { mode: 'ridged', weight: 3 },
      { mode: 'cellular', weight: 2 },
    ],
  },
  {
    id: 'oceanic',
    publicName: 'Oceanic',
    palette: {
      colors: ['#082f49', '#0369a1', '#0ea5e9', '#67e8f9', '#e0f2fe'],
      coolorsUrl: 'https://coolors.co/082f49-0369a1-0ea5e9-67e8f9-e0f2fe',
    },
    terrainWeights: [
      { mode: 'ocean-currents', weight: 5 },
      { mode: 'domain-warping', weight: 3 },
      { mode: 'polar-caps', weight: 2 },
    ],
  },
] as const satisfies readonly TypeConfig[]);

/** Six bonus-ball buckets, each allowing all ten Types with a different emphasis. */
export const SEASON_1_TYPE_WEIGHT_PROFILES = deepFreeze(
  [
    [14, 12, 11, 10, 9, 8, 8, 7, 6, 5],
    [5, 14, 12, 11, 10, 9, 8, 8, 7, 6],
    [6, 5, 14, 12, 11, 10, 9, 8, 8, 7],
    [7, 6, 5, 14, 12, 11, 10, 9, 8, 8],
    [8, 7, 6, 5, 14, 12, 11, 10, 9, 8],
    [8, 8, 7, 6, 5, 14, 12, 11, 10, 9],
  ].map((weights, index) => ({
    id: `bonus-profile-${index + 1}`,
    weights,
  })) as readonly TypeWeightProfile[],
);

export function createSeason1Config(seasonId: `0x${string}`): SeasonConfig {
  const config: SeasonConfig = {
    seasonId,
    season: 1,
    types: SEASON_1_TYPES,
    typeWeightProfiles: SEASON_1_TYPE_WEIGHT_PROFILES,
    satelliteCounts: [
      { label: 'None', min: 0, max: 0, weight: 1 },
      { label: 'One', min: 1, max: 1, weight: 4 },
      { label: 'Moons', min: 2, max: 5, weight: 4 },
      { label: 'Ring', min: 40, max: 80, weight: 1 },
    ],
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
    if (
      type.palette.colors.length < 3 ||
      type.palette.colors.length > 16 ||
      !type.palette.colors.every((color) => /^#[\da-f]{6}$/i.test(color))
    ) {
      throw new RangeError('Every Type needs between three and sixteen #rrggbb palette colors.');
    }
    if (
      type.palette.coolorsUrl.length > 256 ||
      !/^https:\/\/coolors\.co\//.test(type.palette.coolorsUrl)
    ) {
      throw new RangeError('Every Type palette must retain its Coolors source URL.');
    }
    if (type.terrainWeights.length === 0 || type.terrainWeights.length > 12)
      throw new RangeError('Every Type needs between one and twelve terrain weights.');
    for (const terrain of type.terrainWeights) {
      if (!isTerrainMode(terrain.mode)) throw new RangeError('Type terrain mode is not supported.');
      assertPositiveInteger(terrain.weight, 'terrain weight');
    }
  }
  if (config.typeWeightProfiles.length !== 6)
    throw new RangeError('Season 1 requires exactly six Type weight profiles.');
  if (new Set(config.typeWeightProfiles.map((profile) => profile.id)).size !== 6) {
    throw new RangeError('Type profile IDs must be unique.');
  }
  for (const profile of config.typeWeightProfiles) {
    if (!profile.id.trim() || profile.weights.length !== config.types.length)
      throw new RangeError('Every Type profile must be named and include one weight per Type.');
    if (profile.weights.some((weight) => !Number.isSafeInteger(weight) || weight <= 0))
      throw new RangeError('Every Type must have a positive safe-integer weight in every profile.');
  }
  if (config.satelliteCounts.length === 0)
    throw new RangeError('Satellite configuration is required.');
  if (
    new Set(config.satelliteCounts.map((entry) => entry.label)).size !==
    config.satelliteCounts.length
  )
    throw new RangeError('Satellite labels must be unique.');
  for (const entry of config.satelliteCounts) {
    if (!entry.label.trim() || entry.label.length > 32)
      throw new RangeError('Satellite labels must contain between 1 and 32 characters.');
    assertPositiveInteger(entry.weight, 'satellite weight');
    if (
      !Number.isSafeInteger(entry.min) ||
      !Number.isSafeInteger(entry.max) ||
      entry.min < 0 ||
      entry.max < entry.min ||
      entry.max > 10_000
    )
      throw new RangeError('Satellite count range is invalid.');
  }
  validateRarity(config.rarity);
}
