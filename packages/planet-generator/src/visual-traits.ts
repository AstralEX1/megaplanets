import { deriveOriginalCavityColors } from './generator';
import { type DeterministicRandom, namedVisualRandom } from './random';
import { GENERATOR_CONFIG, getPaletteProfile, getPaletteWeights } from './render-config';
import type { TerrainMode, TypePalette, TypeVisualProfile } from './types';
import { GENERATOR_VERSION } from './types';
import type {
  Hex,
  HexColor,
  NoiseMode,
  NormalizedPlanetVisualInput,
  PaletteType,
  PlanetColors,
  PlanetRenderDescriptor,
  PlanetTypeId,
  PlanetVisualInput,
  SatelliteTrait,
} from './visual-types';
import { isPlanetType } from './visual-types';

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
  const surfaces = [
    ...planet.filter((colorValue): colorValue is HexColor => colorValue !== null),
    ...cloud,
  ];
  const candidates = satelliteHueOffsets(paletteType).map((offset, index) =>
    color(rng, hueBase + offset, index % 2 === 0 ? 88 : 72, index % 2 === 0 ? 100 : 82, 12, 8, 6),
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
    (candidate) =>
      candidate.candidate !== first &&
      colorDistance(candidate.candidate, first ?? candidate.candidate) >= 90,
  )?.candidate;
  if (!first || !second) throw new Error('Could not derive contrast satellite colors.');
  return [first, second];
}

function deriveSatellites(
  rng: DeterministicRandom,
  diameter: number,
  colors: PlanetColors,
  hasRing: boolean,
  exactCount?: number,
): readonly SatelliteTrait[] {
  const count =
    exactCount ??
    (hasRing
      ? Math.ceil(
          rng.float(
            GENERATOR_CONFIG.ringParticleMultiplier.min,
            GENERATOR_CONFIG.ringParticleMultiplier.maxExclusive,
          ) * diameter,
        )
      : rng.int(
          GENERATOR_CONFIG.ordinarySatellites.min,
          GENERATOR_CONFIG.ordinarySatellites.maxExclusive,
        ));
  if (!Number.isSafeInteger(count) || count < 0 || count > 512) {
    throw new RangeError('Satellite count is outside the supported range.');
  }
  const maxExclusive = Math.max(
    GENERATOR_CONFIG.satelliteDiameter.min + 1,
    Math.ceil(diameter / GENERATOR_CONFIG.satelliteDiameter.divisor),
  );
  return Array.from({ length: count }, () => ({
    diameter: rng.int(GENERATOR_CONFIG.satelliteDiameter.min, maxExclusive),
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

function jitterPalette(colors: readonly HexColor[], rng: DeterministicRandom): readonly HexColor[] {
  const jittered = colors.map((entry) => {
    const [red, green, blue] = rgb(entry);
    const delta = rng.int(-12, 13);
    const channel = (value: number) =>
      Math.max(0, Math.min(255, value + delta))
        .toString(16)
        .padStart(2, '0');
    return `#${channel(red)}${channel(green)}${channel(blue)}` as HexColor;
  });
  return jittered.map((entry, index) => {
    if (!jittered.slice(0, index).some((colorValue) => colorDistance(entry, colorValue) < 65))
      return entry;
    const [red, green, blue] = rgb(entry);
    const delta = index % 2 === 0 ? 46 : -46;
    const channel = (value: number) =>
      Math.max(0, Math.min(255, value + delta))
        .toString(16)
        .padStart(2, '0');
    return `#${channel(red)}${channel(green)}${channel(blue)}` as HexColor;
  });
}

function derivePlanetForTypeFromBase(
  base: PlanetRenderDescriptor,
  planetType: PlanetTypeId,
  canonicalPalette: TypePalette,
  terrain: TerrainMode,
  profile: TypeVisualProfile,
): PlanetRenderDescriptor {
  if (!isPlanetType(planetType)) throw new RangeError('Unsupported Planet Type.');
  const rng = namedVisualRandom(base.seed, `type:${planetType}`);
  const palette = jitterPalette(canonicalPalette.colors, rng);
  let colors: PlanetColors = {
    ...base.traits.colors,
    planet: palette.slice(0, 3),
  };
  let paletteType = base.traits.paletteType;
  let baseHue = base.traits.baseHue;
  const diameter = Math.round(base.traits.diameter * profile.diameterMultiplier);
  const noiseMode: NoiseMode = terrain;
  let hasClouds = false;
  let cloudNoiseMode: NoiseMode | null = null;
  let cloudWeights: readonly number[] | undefined;
  let cloudDirection: 1 | -1 | undefined;
  let cloudLapMs: number | null = null;
  let mainLapMs = Math.round(base.traits.mainLapMs * profile.mainLapMultiplier);
  if (profile.minimumMainLapMs !== undefined) {
    mainLapMs = Math.max(profile.minimumMainLapMs, mainLapMs);
  }

  switch (profile.cloudStyle) {
    case 'none':
      break;
    case 'standard':
      hasClouds = rng.weightedIndex([4, 1]) === 0;
      if (hasClouds) {
        cloudNoiseMode = rng.weightedIndex([3, 1]) === 0 ? 'simplex' : 'domain-warping';
        cloudWeights = [2, 3, 3];
        cloudLapMs = Math.round(mainLapMs * rng.float(1.5, 2));
      }
      break;
    case 'ash':
      hasClouds = rng.weightedIndex([3, 1]) === 1;
      if (hasClouds) {
        cloudNoiseMode = 'domain-warping';
        cloudWeights = [2, 3, 3];
        cloudLapMs = Math.round(mainLapMs * 2.2);
        colors = { ...colors, cloud: ['#a4a8ad', '#45484d'] };
      }
      break;
    case 'oceanic':
      hasClouds = true;
      cloudNoiseMode = rng.weightedIndex([3, 2]) === 0 ? 'simplex' : 'domain-warping';
      cloudWeights = [2, 5, 2];
      cloudLapMs = Math.round(mainLapMs * rng.float(1.3, 1.75));
      colors = { ...colors, cloud: ['#f0f9ff', '#7dd3fc'] };
      break;
    case 'nebula':
      hasClouds = true;
      cloudNoiseMode = rng.weightedIndex([3, 2]) === 0 ? 'simplex' : 'domain-warping';
      cloudWeights = [2, 3, 3];
      cloudDirection = rng.weightedIndex([3, 1]) === 1 ? -1 : 1;
      if (cloudDirection === -1) mainLapMs = Math.round(mainLapMs * 1.65);
      cloudLapMs = Math.round(mainLapMs * rng.float(0.8, 0.98));
      colors = { ...colors, cloud: ['#fff1a8', '#ff3ea5'] };
      break;
    case 'gas-giant': {
      hasClouds = true;
      const gasCloudModes = ['horizontal-stripes', 'domain-warping', 'simplex'] as const;
      cloudNoiseMode = gasCloudModes[rng.weightedIndex([5, 3, 2])] ?? 'horizontal-stripes';
      cloudLapMs = Math.round(mainLapMs * 1.6);
      cloudWeights = [
        [1, 8, 1],
        [1, 6, 1],
        [1, 7, 2],
      ][rng.weightedIndex([4, 4, 2])] ?? [1, 8, 1];
      colors = { ...colors, cloud: [palette[3] ?? '#fff3d1', palette[1] ?? '#8c5a3c'] };
      break;
    }
    case 'gaia':
      hasClouds = rng.weightedIndex([4, 1]) === 0;
      if (hasClouds) {
        cloudNoiseMode = rng.weightedIndex([3, 1]) === 0 ? 'simplex' : 'domain-warping';
        cloudWeights = [2, 3, 3];
        cloudLapMs = Math.round(mainLapMs * rng.float(1.5, 2));
        colors = { ...colors, cloud: ['#f5f7f5', '#8c9690'] };
      }
      break;
  }

  switch (profile.satelliteStyle) {
    case 'ash': {
      const ash = jitterPalette(['#525252', '#909090', '#b8b8b8'], rng);
      colors = { ...colors, satellite: [ash[0] ?? '#525252', ash[1] ?? '#909090'] };
      break;
    }
    case 'gray': {
      const gray = jitterPalette(['#707070', '#a0a0a0', '#d0d0d0'], rng);
      colors = { ...colors, satellite: [gray[0] ?? '#707070', gray[1] ?? '#a0a0a0'] };
      break;
    }
    case 'cavity': {
      const cavity = deriveOriginalCavityColors(base.seed);
      colors = {
        background: cavity.background,
        planet: [null, cavity.core, null],
        cloud: cavity.cloud,
        satellite: cavity.satellite,
        star: cavity.star,
      };
      paletteType = 'cavity';
      baseHue = 0;
      break;
    }
    case 'standard':
    case 'gas-giant':
      colors = {
        ...colors,
        satellite: createSatelliteColors(paletteType, baseHue, colors.planet, colors.cloud, rng),
      };
      break;
    case 'rocky':
      break;
  }
  const traits = {
    ...base.traits,
    colors,
    paletteType,
    baseHue,
    diameter,
    noiseMode,
    hasClouds,
    cloudNoiseMode,
    cloudWeights,
    cloudDirection,
    cloudLapMs,
    mainLapMs,
    hasRing: false,
    satellites: [],
    planetType,
  } as const;
  return { ...base, traits };
}

function derivePlanetVisualFromSeed(
  normalized: NormalizedPlanetVisualInput,
  seed: Hex,
): PlanetRenderDescriptor {
  const terrainRng = namedVisualRandom(seed, 'terrain');
  const backgroundRng = namedVisualRandom(seed, 'background');

  const paletteType: PaletteType = 'analogous';
  const baseHue = backgroundRng.int(0, 360);
  const colors: PlanetColors = {
    background: color(backgroundRng, baseHue + 180, 15, 15, 20, 0, 0),
    // TypeVisualProfile replaces this placeholder before any frame is rendered.
    planet: ['#1f2937', '#64748b', '#e2e8f0'],
    cloud: [
      color(backgroundRng, baseHue, 10, 100, 20, 10, 0),
      color(backgroundRng, baseHue, 10, 80, 20, 10, 0),
    ],
    satellite: ['#f8fafc', '#94a3b8'],
    star: [
      color(backgroundRng, baseHue + 180, 10, 100, 20, 0, 0),
      color(backgroundRng, baseHue + 180, 20, 40, 20, 0, 0),
    ],
  };

  const firstDiameter = terrainRng.int(
    GENERATOR_CONFIG.planetDiameter.min,
    GENERATOR_CONFIG.planetDiameter.maxExclusive,
  );
  const secondDiameter = terrainRng.int(
    GENERATOR_CONFIG.planetDiameter.min,
    GENERATOR_CONFIG.planetDiameter.maxExclusive,
  );
  const diameter = Math.max(firstDiameter, secondDiameter);
  const mainLapMs = Math.round(terrainRng.float(3_000, 5_000));
  const starCount = backgroundRng.int(
    GENERATOR_CONFIG.starCount.min,
    GENERATOR_CONFIG.starCount.maxExclusive,
  );

  const traits = {
    generatorVersion: GENERATOR_VERSION,
    paletteType,
    typePalette: colors.planet.filter((color): color is HexColor => color !== null),
    paletteProfile: getPaletteProfile(normalized.bonusBall),
    paletteWeights: getPaletteWeights(normalized.bonusBall),
    baseHue,
    colors,
    noiseMode: 'simplex' as NoiseMode,
    diameter,
    hasClouds: false,
    cloudNoiseMode: null,
    mainLapMs,
    cloudLapMs: null,
    hasRing: false,
    satellites: [],
    starCount,
    specialEditionId: null,
  } as const;
  return { input: normalized, seed, traits };
}

function normalizeVisualInput(input: PlanetVisualInput): NormalizedPlanetVisualInput {
  const uint256Max = (1n << 256n) - 1n;
  if (input.ticketId <= 0n || input.ticketId > uint256Max) {
    throw new RangeError('ticketId must be a positive uint256.');
  }
  if (input.drawingId <= 0n || input.drawingId > uint256Max) {
    throw new RangeError('drawingId must be a positive uint256.');
  }
  if (!Number.isInteger(input.bonusBall) || input.bonusBall < 1 || input.bonusBall > 255) {
    throw new RangeError('bonusBall must be an integer between 1 and 255.');
  }
  if (input.normals.length !== 5) throw new RangeError('Exactly five normal balls are required.');
  const normals = [...input.normals].sort((left, right) => left - right);
  if (new Set(normals).size !== 5) throw new RangeError('Normal balls must be unique.');
  if (normals.some((normal) => !Number.isInteger(normal) || normal < 1 || normal > 255)) {
    throw new RangeError('Normal balls must be integers between 1 and 255.');
  }
  return { ...input, normals: normals as [number, number, number, number, number] };
}

export type CanonicalVisualOptions = {
  palette: TypePalette;
  terrain: TerrainMode;
  satelliteCount: number;
  hasRing: boolean;
  profile: TypeVisualProfile;
};

/** Applies the canonical descriptor's palette, terrain, and satellite profile to the renderer. */
export function derivePlanetVisualForType(
  input: PlanetVisualInput,
  planetType: PlanetTypeId,
  seed: Hex,
  options: CanonicalVisualOptions,
): PlanetRenderDescriptor {
  if (!/^0x[\da-fA-F]{64}$/.test(seed)) {
    throw new RangeError('seed must be a 0x-prefixed bytes32 hex value.');
  }
  const visual = derivePlanetForTypeFromBase(
    derivePlanetVisualFromSeed(normalizeVisualInput(input), seed.toLowerCase() as Hex),
    planetType,
    options.palette,
    options.terrain,
    options.profile,
  );
  const baseSatellites = deriveSatellites(
    namedVisualRandom(seed, 'canonical-satellites'),
    visual.traits.diameter,
    visual.traits.colors,
    options.hasRing,
    options.satelliteCount,
  );
  const satellites = baseSatellites.map((satellite, index) => {
    if (options.profile.satelliteStyle === 'rocky') {
      const color = visual.traits.colors.planet[(index + 1) % visual.traits.colors.planet.length];
      return {
        ...satellite,
        color: color ?? '#777b75',
        speed: round(namedVisualRandom(seed, `rocky-satellite:${index}`).float(0.025, 0.08)),
      };
    }
    if (options.profile.satelliteStyle === 'gas-giant') {
      return {
        ...satellite,
        diameter: namedVisualRandom(seed, `gas-satellite:${index}`).int(2, 7),
        speed: round(namedVisualRandom(seed, `gas-satellite-speed:${index}`).float(0.28, 0.82)),
      };
    }
    return satellite;
  });
  return {
    ...visual,
    traits: {
      ...visual.traits,
      typePalette: [...options.palette.colors],
      hasRing: options.hasRing,
      satellites,
    },
  };
}
