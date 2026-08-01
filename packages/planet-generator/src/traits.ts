import { keccak256, stringToHex } from 'viem';
import {
  GENERATOR_CONFIG_V1,
  GENERATOR_VERSION,
  getPaletteProfile,
  getPaletteWeights,
} from './config';
import { namedRandom, type DeterministicRandom } from './random';
import { derivePlanetSeed, normalizePlanetInput } from './seed';
import type {
  HexColor,
  PaletteType,
  PlanetColors,
  PlanetDescriptor,
  PlanetRarity,
  PlanetTicketInput,
  SatelliteTrait,
} from './types';

type RarityRange = { rarity: PlanetRarity; min: bigint; max: bigint; weight: number };

const round = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

function hsbToHex(hue: number, saturation: number, brightness: number): HexColor {
  const h = mod(hue, 360) / 60;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const v = Math.max(0, Math.min(100, brightness)) / 100;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const offset = v - chroma;
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
  const channel = (value: number) =>
    Math.round((value + offset) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

function shiftedHue(hue: number, distance = 15): number {
  const normalized = mod(hue, 360);
  if (240 - distance <= normalized && normalized <= 240 + distance) return 240;
  if (60 < normalized && normalized < 225) return normalized + distance;
  return mod(normalized - distance, 360);
}

function color(
  rng: DeterministicRandom,
  hue: number,
  saturation: number,
  brightness: number,
  hueRange = 10,
  saturationRange = 10,
  brightnessRange = 10,
): HexColor {
  const jitter = (range: number) =>
    range === 0 ? 0 : rng.int(-Math.floor(range / 2), Math.ceil(range / 2) + 1);
  return hsbToHex(
    hue + jitter(hueRange),
    saturation + jitter(saturationRange),
    brightness + jitter(brightnessRange),
  );
}

function rgb(colorValue: HexColor): readonly [number, number, number] {
  return [
    Number.parseInt(colorValue.slice(1, 3), 16),
    Number.parseInt(colorValue.slice(3, 5), 16),
    Number.parseInt(colorValue.slice(5, 7), 16),
  ];
}

function colorDistance(first: HexColor, second: HexColor): number {
  const [firstRed, firstGreen, firstBlue] = rgb(first);
  const [secondRed, secondGreen, secondBlue] = rgb(second);
  return Math.hypot(firstRed - secondRed, firstGreen - secondGreen, firstBlue - secondBlue);
}

function satelliteHueOffsets(paletteType: PaletteType): readonly number[] {
  switch (paletteType) {
    case 'analogous':
    case 'cavity':
      return [150, 180, 210, 120, 240];
    case 'complementary':
      return [60, 90, 120, 240, 270, 300];
    case 'split-complementary':
      return [70, 90, 110, 250, 270, 290];
    case 'triad':
      return [60, 180, 300, 30, 150, 210];
    case 'earth':
      // Mirrors the warm yellow/orange satellite family of the source Earth template.
      return [35, 50, 65, 300, 315];
  }
}

function createSatelliteColors(
  paletteType: PaletteType,
  baseHue: number,
  planet: readonly (HexColor | null)[],
  cloud: readonly [HexColor, HexColor],
  rng: DeterministicRandom,
): readonly [HexColor, HexColor] {
  const hueBase = paletteType === 'earth' ? 0 : baseHue;
  const surfaces = [...planet.filter((colorValue): colorValue is HexColor => colorValue !== null), ...cloud];
  const candidates = satelliteHueOffsets(paletteType).map((offset, index) =>
    color(
      rng,
      hueBase + offset,
      index % 2 === 0 ? 88 : 72,
      index % 2 === 0 ? 100 : 82,
      12,
      8,
      6,
    ),
  );
  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      contrast: Math.min(...surfaces.map((surface) => colorDistance(candidate, surface))),
    }))
    .sort((first, second) => second.contrast - first.contrast || first.index - second.index);
  const first = ranked[0]?.candidate;
  const second = ranked.find(
    (candidate) => candidate.candidate !== first && colorDistance(candidate.candidate, first ?? candidate.candidate) >= 90,
  )?.candidate;
  if (!first || !second) throw new Error('Could not derive contrast satellite colors.');
  return [first, second];
}

function createColors(
  paletteType: PaletteType,
  baseHue: number,
  paletteRng: DeterministicRandom,
  backgroundRng: DeterministicRandom,
  satelliteColorRng: DeterministicRandom,
): PlanetColors {
  const background = color(backgroundRng, baseHue + 180, 15, 15, 20, 0, 0);
  const cloud = [
    color(backgroundRng, baseHue, 10, 100, 20, 10, 0),
    color(backgroundRng, baseHue, 10, 80, 20, 10, 0),
  ] as const;
  // Keep the source palette stream position stable while satellite colors use their
  // own named stream. This avoids changing terrain colors when only satellites evolve.
  color(paletteRng, baseHue + 45, 30, 90, 20, 10, 10);
  color(paletteRng, shiftedHue(baseHue + 45), 50, 70, 20, 10, 10);
  const star = [
    color(backgroundRng, baseHue + 180, 10, 100, 20, 0, 0),
    color(backgroundRng, baseHue + 180, 20, 40, 20, 0, 0),
  ] as const;

  let planet: readonly (HexColor | null)[];
  switch (paletteType) {
    case 'analogous':
      planet = [
        color(paletteRng, baseHue, 60, 90),
        color(paletteRng, shiftedHue(baseHue, 15), 65, 75),
        color(paletteRng, shiftedHue(baseHue, 30), 70, 60),
      ];
      break;
    case 'complementary':
      planet = [
        color(paletteRng, shiftedHue(baseHue, 15), 60, 75),
        color(paletteRng, baseHue, 60, 90),
        color(paletteRng, baseHue + 180, 60, 90),
      ];
      break;
    case 'split-complementary':
      planet = [
        color(paletteRng, baseHue + 160, 40, 90),
        color(paletteRng, baseHue, 60, 90),
        color(paletteRng, baseHue + 200, 40, 90),
      ];
      break;
    case 'triad':
      planet = [
        color(paletteRng, baseHue + 120, 40, 90),
        color(paletteRng, baseHue, 60, 90),
        color(paletteRng, baseHue + 240, 40, 90),
      ];
      break;
    case 'cavity':
      planet = [null, color(paletteRng, baseHue, 60, 90), null];
      break;
    case 'earth':
      planet = [
        color(paletteRng, 210, 60, 85),
        color(paletteRng, 200, 60, 85),
        color(paletteRng, 135, 70, 90),
      ];
      break;
  }

  const satellite = createSatelliteColors(paletteType, baseHue, planet, cloud, satelliteColorRng);
  return { background, planet, cloud, satellite, star };
}

export function getRarityRanges(drawingId: bigint): readonly RarityRange[] {
  if (drawingId <= 0n) throw new RangeError('drawingId must be positive.');
  const cap = drawingId - 1n;
  const configured: readonly RarityRange[] = [
    {
      rarity: 'Common',
      min: 1n,
      max: cap < 100n ? cap : 100n,
      weight: GENERATOR_CONFIG_V1.rarityWeights.Common,
    },
    {
      rarity: 'Uncommon',
      min: 101n,
      max: cap < 250n ? cap : 250n,
      weight: GENERATOR_CONFIG_V1.rarityWeights.Uncommon,
    },
    {
      rarity: 'Rare',
      min: 251n,
      max: cap < 499n ? cap : 499n,
      weight: GENERATOR_CONFIG_V1.rarityWeights.Rare,
    },
    {
      rarity: 'Legendary',
      min: 500n,
      max: cap,
      weight: GENERATOR_CONFIG_V1.rarityWeights.Legendary,
    },
    {
      rarity: '42',
      min: drawingId,
      max: drawingId,
      weight: GENERATOR_CONFIG_V1.rarityWeights['42'],
    },
  ];
  return configured.filter((range) => range.min <= range.max);
}

function derivePoints(seed: `0x${string}`, drawingId: bigint) {
  const rng = namedRandom(seed, 'rarity');
  const ranges = getRarityRanges(drawingId);
  const selected = ranges[rng.weightedIndex(ranges.map((range) => range.weight))];
  if (!selected) throw new Error('Rarity selection produced no range.');
  return {
    rarity: selected.rarity,
    dailyPoints: rng.bigintInclusive(selected.min, selected.max),
  };
}

function deriveSatellites(
  rng: DeterministicRandom,
  diameter: number,
  colors: PlanetColors,
  hasRing: boolean,
): readonly SatelliteTrait[] {
  const bounds = hasRing
    ? GENERATOR_CONFIG_V1.ringParticles
    : GENERATOR_CONFIG_V1.ordinarySatellites;
  const count = rng.int(bounds.min, bounds.maxExclusive);
  return Array.from({ length: count }, () => ({
    diameter: hasRing ? rng.int(1, 3) : rng.int(2, Math.max(3, Math.floor(diameter / 8) + 1)),
    color: colors.satellite[rng.weightedIndex([1, 1])],
    speed: round(rng.float(0.5, 1.5)),
    orbitX: rng.int(Math.floor((diameter * 3) / 4), diameter + 1),
    orbitY: rng.int(
      Math.max(1, Math.floor(diameter / 8)),
      Math.max(2, Math.floor(diameter / 4) + 1),
    ),
    initialAngle: rng.int(0, 360),
    rotation: hasRing ? 0 : rng.int(-90, 91),
  }));
}

export function derivePlanet(input: PlanetTicketInput): PlanetDescriptor {
  const normalized = normalizePlanetInput(input);
  const seed = derivePlanetSeed(normalized);
  const paletteRng = namedRandom(seed, 'palette');
  const terrainRng = namedRandom(seed, 'terrain');
  const satelliteRng = namedRandom(seed, 'satellites');
  const satelliteColorRng = namedRandom(seed, 'satellite-colors');
  const backgroundRng = namedRandom(seed, 'background');
  const points = derivePoints(seed, normalized.drawingId);

  const paletteWeights = getPaletteWeights(normalized.bonusBall);
  const paletteIndex = paletteRng.weightedIndex(paletteWeights);
  const paletteType = GENERATOR_CONFIG_V1.paletteTypes[paletteIndex];
  if (!paletteType) throw new Error('Palette selection exceeded configured palette types.');
  const baseHue = paletteRng.int(0, 360);
  const colors = createColors(
    paletteType,
    baseHue,
    paletteRng,
    backgroundRng,
    satelliteColorRng,
  );

  const firstDiameter = terrainRng.int(
    GENERATOR_CONFIG_V1.planetDiameter.min,
    GENERATOR_CONFIG_V1.planetDiameter.maxExclusive,
  );
  const secondDiameter = terrainRng.int(
    GENERATOR_CONFIG_V1.planetDiameter.min,
    GENERATOR_CONFIG_V1.planetDiameter.maxExclusive,
  );
  const diameter = Math.max(firstDiameter, secondDiameter);
  const noiseGroup = Math.floor(paletteIndex / 2);
  const noiseWeights = GENERATOR_CONFIG_V1.noiseWeights[noiseGroup];
  if (!noiseWeights) throw new Error('Palette has no terrain distribution.');
  const noiseMode = GENERATOR_CONFIG_V1.noiseModes[terrainRng.weightedIndex(noiseWeights)];
  if (!noiseMode) throw new Error('Terrain selection exceeded configured noise modes.');

  const hasClouds = paletteType !== 'cavity' && terrainRng.weightedIndex([4, 1]) === 0;
  const cloudNoiseMode = hasClouds
    ? terrainRng.weightedIndex([3, 1]) === 0
      ? 'simplex'
      : 'domain-warping'
    : null;
  const mainLapMs = Math.round(terrainRng.float(3_000, 5_000));
  const cloudLapMs = hasClouds ? Math.round(mainLapMs * terrainRng.float(1.5, 2)) : null;
  const hasRing = satelliteRng.weightedIndex([1, 5]) === 0;
  const satellites = deriveSatellites(satelliteRng, diameter, colors, hasRing);
  const starCount = backgroundRng.int(
    GENERATOR_CONFIG_V1.starCount.min,
    GENERATOR_CONFIG_V1.starCount.maxExclusive,
  );

  const traits = {
    generatorVersion: GENERATOR_VERSION,
    paletteType,
    paletteProfile: getPaletteProfile(normalized.bonusBall),
    paletteWeights,
    baseHue,
    colors,
    noiseMode,
    diameter,
    hasClouds,
    cloudNoiseMode,
    mainLapMs,
    cloudLapMs,
    hasRing,
    satellites,
    starCount,
    rarity: points.rarity,
    dailyPoints: points.dailyPoints.toString(),
    specialEditionId: null,
  } as const;
  const canonicalTraitsJson = JSON.stringify(traits);

  return {
    input: normalized,
    seed,
    dailyPoints: points.dailyPoints,
    rarity: points.rarity,
    traits,
    canonicalTraitsJson,
    traitsHash: keccak256(stringToHex(canonicalTraitsJson)),
  };
}
