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

function palette(
  colors: readonly [HexColor, HexColor, HexColor, ...HexColor[]],
  name?: string,
): TypePalette {
  return {
    ...(name ? { name } : {}),
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
        palette(['#590d22', '#a4133c', '#e0aaff'], 'Bordeaux Violet Mist'),
        palette(['#800f2f', '#c9184a', '#e0aaff'], 'Cherry Violet Nebula'),
        palette(['#10002b', '#3c096c', '#7b2cbf'], 'Violet Void'),
        palette(['#240046', '#5a189a', '#c77dff'], 'Amethyst Arc'),
        palette(['#a4133c', '#ff4d6d', '#e0aaff'], 'Rose Fire Veil'),
        palette(['#3c096c', '#9d4edd', '#e0aaff'], 'Lavender Spell'),
        palette(['#10002b', '#5a189a', '#9d4edd'], 'Indigo Velvet Bloom'),
        palette(['#3c096c', '#7b2cbf', '#ff4d6d'], 'Violet Rose Rift'),
        palette(['#800f2f', '#c9184a', '#c77dff'], 'Amethyst Cherry'),
        palette(['#590d22', '#c9184a', '#9d4edd'], 'Mauve Fire Veil'),
        palette(['#240046', '#7b2cbf', '#e0aaff'], 'Royal Violet Mist'),
        palette(['#800f2f', '#5a189a', '#c77dff'], 'Dark Amaranth Orchid'),
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
        palette(['#34140e', '#ce812c', '#e7d99c'], 'Dune Ember Gradient'),
        palette(['#201408', '#8a5428', '#f0c880'], 'Night Ochre Gradient'),
        palette(['#352208', '#7b6b43', '#e1bb80'], 'Olive Fawn Sands'),
        palette(['#644536', '#b87d48', '#ffe0b5'], 'Navajo Copper Dunes'),
        palette(['#0e0705', '#653019', '#e3ba66'], 'Dark Coffee Horizon'),
      ],
      terrainWeights: [
        { mode: 'vertical-stripes', weight: 5 },
        { mode: 'ridged', weight: 3 },
        { mode: 'cellular', weight: 2 },
        { mode: 'simplex', weight: 2 },
        { mode: 'domain-warping', weight: 4 },
        { mode: 'pixel-continents', weight: 3 },
        { mode: 'archipelago', weight: 2 },
        { mode: 'pixel-mountain-ridges', weight: 2 },
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
        palette(['#f94144', '#f9c74f', '#277da1'], 'Sunset Gradient'),
        palette(['#d9ed92', '#34a0a4', '#184e77'], 'Ocean Teal Gradient'),
        palette(['#007f5f', '#aacc00', '#ffff3f'], 'Jungle Lime Gradient'),
        palette(['#b5e48c', '#168aad', '#184e77'], 'Mint to Baltic Gradient'),
        palette(['#f94144', '#43aa8b', '#577590'], 'Coral Teal Contrast'),
        palette(['#f3722c', '#1a759f', '#eeef20'], 'Tangerine Cyan Contrast'),
        palette(['#d4d700', '#4d908e', '#f9844a'], 'Lime Teal Coral Contrast'),
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
        palette(['#ff1744', '#00e5ff', '#76ff03'], 'Toxic Red Cyan Lime'),
        palette(['#7c4dff', '#ffea00', '#00e676'], 'Toxic Violet Gold Green'),
        palette(['#ff1744', '#a855f7', '#00e5ff'], 'Toxic Red Violet Cyan'),
        palette(['#e6c229', '#d11149', '#1a8fe3'], 'Saffron Ocean Pulse'),
        palette(['#01befe', '#ff7d00', '#adff02'], 'Neon Tangerine Lime'),
        palette(['#6a00ff', '#ff00ff', '#ffdd00'], 'Indigo Pink Gold'),
        palette(['#ff0040', '#00ff15', '#0095ff'], 'Lipstick Lime Blue'),
        palette(['#ff00a1', '#90fe00', '#00fff7'], 'Rose Lime Ice'),
        palette(['#ff0000', '#00ff00', '#0000ff'], 'Primary Poison'),
        palette(['#44d800', '#7f00ff', '#ff3800'], 'Radioactive Violet Flame'),
        palette(['#ff2b67', '#00ffce', '#ffeb00'], 'Fuchsia Mint Sunbeam'),
        palette(['#d11149', '#00ffff', '#8f00ff'], 'Cherry Cyan Violet'),
        palette(['#ff7300', '#ff1dce', '#00ffce'], 'Pumpkin Neon Current'),
      ],
      terrainWeights: [
        { mode: 'vertical-stripes', weight: 5 },
        { mode: 'horizontal-stripes', weight: 4 },
        { mode: 'domain-warping', weight: 1 },
        { mode: 'spiral-currents', weight: 3 },
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
        palette(['#0077b6', '#00b4d8', '#606c38'], 'Ocean Blue Serenity & Olive Shore'),
        palette(['#0077b6', '#00b4d8', '#2c6e49'], 'Ocean Blue Serenity & Turf Green'),
        palette(['#0077b6', '#00b4d8', '#538d22'], 'Ocean Blue Serenity & Forest Moss'),
        palette(['#0077b6', '#00b4d8', '#155d27'], 'Ocean Blue Serenity & Dark Emerald'),
        palette(['#0077b6', '#00b4d8', '#2dc653'], 'Ocean Blue Serenity & Jade Green'),
        palette(['#2c6e49', '#4c956c', '#0077b6'], 'Turf & Sea Green with Ocean Blue'),
        palette(['#143601', '#538d22', '#427aa1'], 'Black Forest & Moss with Coastal Blue'),
        palette(['#155d27', '#2dc653', '#42bfdd'], 'Emerald & Jade with Sky Surge'),
        palette(['#73a942', '#aad576', '#61a5c2'], 'Sage & Willow with Steel Blue'),
        palette(['#134074', '#8da9c4', '#4c956c'], 'Deep Blue Sea & Mint Coast'),
        palette(['#2c6e49', '#4c956c', '#427aa1'], 'Minty Floral Coast'),
        palette(['#588157', '#a3b18a', '#468faf'], 'Leafy Forest Retreat & Coast'),
        palette(['#89c2d9', '#a9d6e5', '#4c956c'], 'Frosted Coast & Green Land'),
        palette(['#0096c7', '#48cae4', '#c38e70'], 'Turquoise Surf & Toasted Earth'),
        palette(['#013a63', '#2c7da0', '#9d6b53'], 'Coastal Night & Cinnamon Soil'),
        palette(['#90e0ef', '#ade8f4', '#deab90'], 'Frosted Water & Light Bronze'),
        palette(['#084b83', '#42bfdd', '#774936'], 'Sky Surge & Clay Soil'),
        // Template.earth in the original Astraea generator: HSB(210, 65%, 85%),
        // HSB(200, 70%, 85%), HSB(135, 80%, 90%).
        palette(['#4c92d9', '#41a6d9', '#2ee65c'], 'Template Earth'),
        // Land-rich: two adjacent land colors and one blue ocean color.
        palette(['#606c38', '#386641', '#427aa1'], 'Land-Rich Forest & Sea'),
      ],
      terrainWeights: [
        { mode: 'simplex', weight: 2 },
        { mode: 'domain-warping', weight: 4 },
        { mode: 'pixel-continents', weight: 3 },
        { mode: 'archipelago', weight: 2 },
        { mode: 'pixel-mountain-ridges', weight: 2 },
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
        palette(['#353535', '#6f6866', '#ff9505'], 'Deep Saffron Rock'),
        palette(['#353535', '#6f6866', '#e89005'], 'Carrot Fire Rock'),
        palette(['#353535', '#6f6866', '#ffb627'], 'Amber Flame Rock'),
        palette(['#3c6e71', '#2d2e2e', '#f42b03'], 'Slate Ember Rock'),
        palette(['#2d2e2e', '#6f6866', '#bc3908'], 'Ash and Rust Rock'),
        palette(['#38302e', '#6f6866', '#e70e02'], 'Granite Molten Rock'),
        palette(['#0a0908', '#353535', '#bc3908'], 'Black Glass Ruby Rock'),
        palette(['#0a0908', '#e89005', '#f42b03'], 'Obsidian Tangerine Flow'),
        palette(['#0a0908', '#bc3908', '#e70e02'], 'Graphite Crimson Flow'),
      ],
      terrainWeights: [
        { mode: 'turbulence', weight: 5 },
        { mode: 'ridged', weight: 3 },
        { mode: 'cratered', weight: 2 },
        { mode: 'domain-warping', weight: 3 },
        { mode: 'archipelago', weight: 2 },
        { mode: 'cellular', weight: 2 },
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
        palette(['#353535', '#3c6e71', '#828e82'], 'Monochrome Beach'),
        palette(['#9db5b2', '#6f6866', '#38302e'], 'Grayscale Harmony'),
        palette(['#bca3ac', '#2d2e2e', '#a99985'], 'Lilac Ash & Onyx'),
      ],
      terrainWeights: [
        { mode: 'simplex', weight: 2 },
        { mode: 'domain-warping', weight: 4 },
        { mode: 'pixel-continents', weight: 3 },
        { mode: 'archipelago', weight: 2 },
        { mode: 'cratered', weight: 2 },
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
        // Ordered as light edge -> saturated transition -> deep edge. The
        // middle tone is intentionally separated from both neighbours so
        // adjacent terrain bands remain readable in pixel art.
        palette(['#e3f2fd', '#64b5f6', '#90caf9'], 'Blue Gradient: Ice to Sky'),
        palette(['#64b5f6', '#42a5f5', '#2196f3'], 'Blue Gradient: Sky to Azure'),
        palette(['#1976d2', '#1565c0', '#0d47a1'], 'Blue Gradient: Cobalt Depths'),
        palette(['#023e8a', '#0077b6', '#00b4d8'], 'Ocean Blue Serenity'),
        palette(['#90e0ef', '#ade8f4', '#caf0f8'], 'Ocean Blue Serenity: Ice Light'),
        palette(['#2c7da0', '#61a5c2', '#89c2d9'], 'Coastal Blues'),
        palette(['#0b2545', '#13315c', '#134074'], 'Deep Blue Sea'),
        palette(['#d9f0ff', '#a3d5ff', '#83c9f4'], 'Ice Shelf Blue'),
        palette(['#006d77', '#83c5be', '#edf6f9'], 'Ocean Pearl Delight'),
        palette(['#006d77', '#83c5be', '#ffddd2'], 'Ocean Pearl & Blush'),
        palette(['#07beb8', '#3dccc7', '#68d8d6'], 'Turquoise Waters'),
        palette(['#68d8d6', '#9ceaeF', '#c4fff9'], 'Turquoise Ice Waters'),
        palette(['#42bfdd', '#bbe6e4', '#e29578'], 'Sky Surge & Warm Pearl'),
        palette(['#5465ff', '#788bff', '#9bb1ff'], 'Electric Sapphire: Cornflower Sky'),
        palette(['#bfd7ff', '#e2fdff', '#5465ff'], 'Electric Sapphire: Ice Light'),
        palette(['#add7f6', '#87bfff', '#3f8efc'], 'Blue Energy: Clear Water'),
        // Keep the two neighbouring transitions high-contrast; the outer
        // colours may remain related because they never form a direct band
        // boundary in the unified 1 -> 2 -> 3 ordering.
        palette(['#3b28cc', '#007bff', '#2667ff'], 'Ultrasonic Blue: Deep Water'),
        palette(['#5465ff', '#3f8efc', '#2667ff'], 'Electric Sapphire: Blue Depth'),
      ],
      terrainWeights: [
        { mode: 'ocean-currents', weight: 4 },
        { mode: 'simplex', weight: 2 },
        { mode: 'domain-warping', weight: 3 },
        { mode: 'archipelago', weight: 2 },
        { mode: 'pixel-mountain-ridges', weight: 2 },
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
    'pixel-continents',
    'archipelago',
    'pixel-mountain-ridges',
    'spiral-currents',
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

function validatePaletteContrast(
  colors: readonly HexColor[],
  label: string,
  minimumDistance = 55,
) {
  for (let index = 1; index < colors.length; index += 1) {
    const previous = colors[index - 1];
    const current = colors[index];
    if (!previous || !current || colorDistance(previous, current) < minimumDistance) {
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
      validatePaletteContrast(
        variant.colors,
        `${type.publicName} palette`,
        type.id === 'gaia' || type.id === 'oceanic' ? 20 : 55,
      );
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
