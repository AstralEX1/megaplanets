import { keccak256, stringToHex } from 'viem';
import { namedRandom } from './generator-random';
import { deepFreeze } from './immutable';
import { normalizePlanetInput } from './input';
import { validateSeasonConfig } from './season-config';
import { derivePlanetSeed } from './seed';
import type { PlanetDescriptor, PlanetInput, PlanetRarity, SeasonConfig } from './types';

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

export function getTypeProfile(config: SeasonConfig, bonusBall: number) {
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
  config: SeasonConfig,
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

/** Derives pure Season 1 metadata traits without rendering a frame or GIF. */
export function derivePlanet(input: PlanetInput, config: SeasonConfig): PlanetDescriptor {
  validateSeasonConfig(config);
  const normalized = normalizePlanetInput(input);
  if (normalized.seasonId.toLowerCase() !== config.seasonId.toLowerCase()) {
    throw new RangeError('input seasonId must match the Season configuration.');
  }

  const seed = derivePlanetSeed(normalized);
  const typeProfile = getTypeProfile(config, normalized.bonusBall);
  const type = getRequired(
    config.types,
    namedRandom(seed, 'type').weightedIndex(typeProfile.weights),
    'Type',
  );
  const terrain = getRequired(
    type.terrainWeights,
    namedRandom(seed, 'terrain').weightedIndex(type.terrainWeights.map((entry) => entry.weight)),
    'Terrain',
  ).mode;
  const satellite = getRequired(
    config.satelliteCounts,
    namedRandom(seed, 'satellites').weightedIndex(
      config.satelliteCounts.map((entry) => entry.weight),
    ),
    'Satellite',
  );
  const satelliteCount =
    satellite.min === satellite.max
      ? satellite.min
      : namedRandom(seed, 'satellite-count').int(satellite.min, satellite.max + 1);
  const mineralResult = deriveMinerals(seed, config);
  const traits = {
    name: derivePlanetName(seed),
    typeId: type.id,
    type: type.publicName,
    palette: type.palette,
    terrain,
    satelliteCount,
    hasRing: satellite.label === 'Ring',
    minerals: mineralResult.minerals,
    rarity: mineralResult.rarity,
    season: config.season,
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
