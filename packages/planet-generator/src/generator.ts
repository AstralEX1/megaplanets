import { keccak256, stringToHex } from 'viem';
import { namedRandom } from './generator-random';
import { deepFreeze } from './immutable';
import { normalizePlanetInput } from './input';
import { validatePlanetConfig } from './planet-config';
import { derivePlanetSeed } from './seed';
import type {
  PlanetDescriptor,
  PlanetInput,
  PlanetRarity,
  PlanetConfig,
  TypeConfig,
  TypePalette,
} from './types';
import type { HexColor } from './visual-types';

/**
 * Phoneme grammar adapted from the supplied namegen script. It synthesizes names
 * instead of selecting from a finite list of existing planet names.
 */
const NAME_PARTS = {
  consonant: [
    'b',
    'c',
    'd',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'p',
    'q',
    'r',
    's',
    't',
    'v',
    'w',
    'x',
    'y',
    'z',
  ],
  vowel: ['a', 'e', 'o', 'u'],
  onset: [
    'br',
    'cr',
    'dr',
    'fr',
    'gr',
    'pr',
    'str',
    'tr',
    'bl',
    'cl',
    'fl',
    'gl',
    'pl',
    'sl',
    'sc',
    'sk',
    'sm',
    'sn',
    'sp',
    'st',
    'sw',
    'ch',
    'sh',
    'th',
    'wh',
  ],
  vowelCluster: [
    'ae',
    'ai',
    'ao',
    'au',
    'a',
    'ay',
    'ea',
    'ei',
    'eo',
    'eu',
    'e',
    'ey',
    'ua',
    'ue',
    'ui',
    'uo',
    'u',
    'uy',
    'ia',
    'ie',
    'iu',
    'io',
    'iy',
    'oa',
    'oe',
    'ou',
    'oi',
    'o',
    'oy',
  ],
  softEnding: [
    'turn',
    'ter',
    'nus',
    'rus',
    'tania',
    'hiri',
    'hines',
    'gawa',
    'nides',
    'carro',
    'rilia',
    'stea',
    'lia',
    'lea',
    'ria',
    'nov',
    'phus',
    'mia',
    'nerth',
    'wei',
    'ruta',
    'tov',
    'zuno',
    'vis',
    'lara',
    'nia',
    'liv',
    'tera',
    'gantu',
    'yama',
    'tune',
    'cury',
    'bos',
    'pra',
    'thea',
    'nope',
    'tis',
    'clite',
  ],
  hardEnding: [
    'una',
    'ion',
    'iea',
    'iri',
    'illes',
    'ides',
    'agua',
    'olla',
    'inda',
    'eshan',
    'oria',
    'ilia',
    'erth',
    'arth',
    'orth',
    'oth',
    'illon',
    'ichi',
    'ov',
    'arvis',
    'ara',
    'ars',
    'yke',
    'yria',
    'onoe',
    'ippe',
    'osie',
    'one',
    'ore',
    'ade',
    'adus',
    'urn',
    'ypso',
    'ora',
    'iuq',
    'orix',
    'apus',
    'eon',
    'eron',
    'ao',
    'omia',
  ],
} as const;

type NamePart = keyof typeof NAME_PARTS;

const NAME_PATTERNS: readonly (readonly NamePart[])[] = [
  ['consonant', 'vowel', 'softEnding'],
  ['vowel', 'onset', 'hardEnding'],
  ['onset', 'vowelCluster', 'softEnding'],
  ['vowelCluster', 'onset', 'hardEnding'],
  ['onset', 'vowelCluster', 'vowel', 'softEnding'],
  ['vowel', 'consonant', 'onset', 'hardEnding'],
  ['onset', 'vowelCluster', 'vowel', 'softEnding'],
  ['vowelCluster', 'onset', 'consonant', 'hardEnding'],
  ['onset', 'vowelCluster', 'consonant', 'vowelCluster', 'softEnding'],
  ['vowelCluster', 'consonant', 'vowelCluster', 'onset', 'hardEnding'],
];

function getRequired<T>(items: readonly T[], index: number, label: string): T {
  const value = items[index];
  if (value === undefined) throw new Error(`${label} selection exceeded its configuration.`);
  return value;
}

export function getTypeProfile(config: PlanetConfig, bonusBall: number) {
  if (!Number.isInteger(bonusBall) || bonusBall < 1 || bonusBall > 255)
    throw new RangeError('bonusBall must be an integer between 1 and 255.');
  if (config.typeWeightProfiles.length === 0) {
    throw new RangeError('At least one Type weight profile is required.');
  }
  return getRequired(
    config.typeWeightProfiles,
    (bonusBall - 1) % config.typeWeightProfiles.length,
    'Type profile',
  );
}

function hsbToHex(hue: number, saturation: number, brightness: number): HexColor {
  const h = (((hue % 360) + 360) % 360) / 60;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const value = Math.max(0, Math.min(100, brightness)) / 100;
  const chroma = value * s;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const offset = value - chroma;
  const [red, green, blue] =
    h < 1
      ? [chroma, x, 0]
      : h < 2
        ? [x, chroma, 0]
        : h < 3
          ? [0, chroma, x]
          : h < 4
            ? [0, x, chroma]
            : h < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const channel = (component: number) =>
    Math.round((component + offset) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

/** Resolves the source generator's Cavity HSB family into deterministic concrete colors. */
export function deriveOriginalCavityColors(seed: `0x${string}`) {
  const rng = namedRandom(seed, 'type-palette');
  const hue = rng.int(0, 360);
  const sample = (
    hueOffset: number,
    hueRange: number,
    saturation: number,
    saturationRange: number,
    brightness: number,
    brightnessRange: number,
  ) =>
    hsbToHex(
      hue + hueOffset + rng.int(-Math.floor(hueRange / 2), Math.ceil(hueRange / 2) + 1),
      saturation + rng.int(-Math.floor(saturationRange / 2), Math.ceil(saturationRange / 2) + 1),
      brightness + rng.int(-Math.floor(brightnessRange / 2), Math.ceil(brightnessRange / 2) + 1),
    );
  const shiftHue = (value: number, distance = 15) => {
    const normalized = ((value % 360) + 360) % 360;
    if (240 - distance <= normalized && normalized <= 240 + distance) return 240;
    if (60 < normalized && normalized < 225) return normalized + distance;
    return (((normalized - distance) % 360) + 360) % 360;
  };
  const background = sample(180, 20, 15, 0, 15, 0);
  const cloudFront = sample(0, 20, 10, 10, 100, 0);
  const cloudBack = sample(0, 20, 10, 10, 80, 0);
  const satelliteFirst = sample(45, 20, 30, 10, 90, 10);
  const satelliteSecond = sample(shiftHue(hue + 45) - hue, 20, 50, 10, 70, 10);
  const starFirst = sample(180, 20, 10, 0, 100, 0);
  const starSecond = sample(180, 20, 20, 0, 40, 0);
  const core = sample(0, 10, 60, 10, 90, 10);
  return {
    core,
    background,
    cloud: [cloudFront, cloudBack] as const,
    satellite: [satelliteFirst, satelliteSecond] as const,
    star: [starFirst, starSecond] as const,
  };
}

function deriveOriginalCavityPalette(seed: `0x${string}`): TypePalette {
  const colors = deriveOriginalCavityColors(seed);
  return {
    colors: [colors.core, colors.cloud[0], colors.cloud[1]],
    coolorsUrl: `https://coolors.co/${colors.core.slice(1)}-${colors.cloud[0].slice(1)}-${colors.cloud[1].slice(1)}`,
  };
}

/** Chooses the canonical palette without affecting Type, terrain, or minerals. */
export function deriveTypePalette(seed: `0x${string}`, type: TypeConfig): TypePalette {
  if (type.visual.paletteMode === 'original-cavity') return deriveOriginalCavityPalette(seed);
  const variants = type.visual.paletteVariants;
  return getRequired(
    variants,
    namedRandom(seed, 'type-palette').weightedIndex(variants.map(() => 1)),
    'Type palette',
  );
}

export function deriveTypeTerrain(seed: `0x${string}`, type: TypeConfig) {
  const terrainWeights = type.visual.terrainWeights;
  return getRequired(
    terrainWeights,
    namedRandom(seed, 'terrain').weightedIndex(terrainWeights.map((entry) => entry.weight)),
    'Terrain',
  ).mode;
}

export function deriveTypeSatellites(seed: `0x${string}`, type: TypeConfig) {
  const choices = type.visual.satellites;
  const satellite = getRequired(
    choices,
    namedRandom(seed, 'satellites').weightedIndex(choices.map((entry) => entry.weight)),
    'Satellite',
  );
  const satelliteCount =
    satellite.min === satellite.max
      ? satellite.min
      : namedRandom(seed, 'satellite-count').int(satellite.min, satellite.max + 1);
  return { satelliteCount, hasRing: satellite.kind === 'ring' };
}

/**
 * Most planets keep a pronounceable proper name; a minority gain an archive-like
 * Roman or catalogue suffix. The independent name stream cannot affect visual traits.
 */
export function derivePlanetName(seed: `0x${string}`): string {
  const rng = namedRandom(seed, 'name');
  const pattern = getRequired(NAME_PATTERNS, rng.int(0, NAME_PATTERNS.length), 'Name pattern');
  const base = pattern
    .map((part) => {
      const values = NAME_PARTS[part];
      return getRequired(values, rng.int(0, values.length), 'Name part');
    })
    .join('');
  const formatted = `${base[0]?.toUpperCase() ?? ''}${base.slice(1)}`;
  const style = rng.weightedIndex([78, 14, 8]);
  if (style === 0) return formatted;
  if (style === 1) return `${formatted} ${['II', 'III', 'IV', 'V'][rng.int(0, 4)]}`;
  return `${formatted}-${rng.int(11, 100)}`;
}

function deriveMinerals(
  seed: `0x${string}`,
  config: PlanetConfig,
): { rarity: PlanetRarity; minerals: number } {
  const rng = namedRandom(seed, 'minerals');
  const rarity = getRequired(
    config.rarity,
    rng.weightedIndex(config.rarity.map((entry) => entry.weight)),
    'Rarity',
  );
  const subrange = getRequired(
    rarity.subranges,
    rng.weightedIndex(rarity.subranges.map((entry) => entry.weight)),
    'Mineral subrange',
  );
  return {
    rarity: rarity.rarity,
    minerals: rng.int(subrange.min, subrange.max + 1),
  };
}

/** Derives pure deterministic metadata traits without rendering a frame or GIF. */
export function derivePlanet(input: PlanetInput, config: PlanetConfig): PlanetDescriptor {
  validatePlanetConfig(config);
  const normalized = normalizePlanetInput(input);

  const seed = derivePlanetSeed(normalized);
  const typeProfile = getTypeProfile(config, normalized.bonusBall);
  const type = getRequired(
    config.types,
    namedRandom(seed, 'type').weightedIndex(typeProfile.weights),
    'Type',
  );
  const terrain = deriveTypeTerrain(seed, type);
  const satellite = deriveTypeSatellites(seed, type);
  const mineralResult = deriveMinerals(seed, config);
  const traits = {
    name: derivePlanetName(seed),
    typeId: type.id,
    type: type.publicName,
    palette: deriveTypePalette(seed, type),
    terrain,
    satelliteCount: satellite.satelliteCount,
    hasRing: satellite.hasRing,
    minerals: mineralResult.minerals,
    rarity: mineralResult.rarity,
    specialEditionId: null,
  } as const;
  const canonicalTraitsJson = JSON.stringify(traits);

  return deepFreeze({
    input: normalized,
    seed,
    traits,
    canonicalTraitsJson,
    traitsHash: keccak256(stringToHex(canonicalTraitsJson)),
  });
}
