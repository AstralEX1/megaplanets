import { type DeterministicRandom, namedVisualRandom } from './random';
import { GENERATOR_CONFIG, getPaletteProfile, getPaletteWeights } from './render-config';
import type { TerrainMode, TypePalette } from './types';
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

const TYPE_PALETTES: Record<PlanetTypeId, readonly (readonly HexColor[])[]> = {
  nebula: [
    ['#1e1b4b', '#f72585', '#facc15', '#4cc9f0'],
    ['#3b0764', '#4cc9f0', '#f59e0b', '#fff7cc'],
    ['#240046', '#f72585', '#4361ee', '#fde047'],
  ],
  desert: [
    ['#4a2c1a', '#b45309', '#f59e0b', '#fef3c7'],
    ['#5b3417', '#c2410c', '#fbbf24', '#fffbeb'],
    ['#422006', '#a16207', '#facc15', '#fef9c3'],
  ],
  triplex: [
    ['#f72585', '#4361ee', '#facc15'],
    ['#00e5ff', '#ff2d95', '#00e5ff'],
    ['#f97316', '#2563eb', '#a855f7'],
  ],
  toxic: [
    ['#ff1744', '#00e5ff', '#76ff03'],
    ['#7c4dff', '#ffea00', '#00e676'],
    ['#ff1744', '#a855f7', '#00e5ff'],
  ],
  gaia: [
    ['#075985', '#0ea5e9', '#16a34a', '#f8fafc'],
    ['#0c4a6e', '#0284c7', '#15803d', '#e2e8f0'],
    ['#164e63', '#0891b2', '#047857', '#f1f5f9'],
  ],
  volcanic: [
    ['#1a0700', '#ff5a00', '#ffd60a', '#ff9f1c'],
    ['#170606', '#7f1d1d', '#dc2626', '#f97316'],
    ['#26110b', '#9a3412', '#ef4444', '#fca5a5'],
  ],
  'gas-giant': [
    ['#5f2f15', '#c96d2d', '#f6c453', '#fef3c7'],
    ['#5f4727', '#b8914a', '#e7c873', '#fff1bf'],
    ['#061a40', '#0b5ed7', '#38bdf8', '#bfe9ff'],
    ['#4a1020', '#c92d5d', '#f472b6', '#ffe4ef'],
  ],
  rocky: [
    ['#1f2421', '#4a4f49', '#777b75', '#aaa69c'],
    ['#171717', '#3f3f46', '#71717a', '#d4d4d8'],
    ['#2f2926', '#62564b', '#928374', '#d5c4a1'],
    ['#293241', '#5c677d', '#a9bcd0', '#d9e2ec'],
  ],
  oceanic: [
    ['#0047ff', '#009dff', '#00e5ff', '#d9fbff'],
    ['#1236d8', '#0077ff', '#21c7ff', '#d6f8ff'],
    ['#0054c7', '#00a6ff', '#45e9ff', '#e0ffff'],
    ['#1d4ed8', '#0ea5e9', '#22d3ee', '#ecfeff'],
    ['#001f9e', '#006dff', '#00c2ff', '#c8f7ff'],
    ['#0039a6', '#008cff', '#3ddcff', '#edffff'],
  ],
  void: [
    ['#120326', '#7c3aed', '#22d3ee', '#f0abfc'],
    ['#080812', '#a21caf', '#f472b6', '#fdf4ff'],
    ['#140a1e', '#6d28d9', '#67e8f9', '#e9d5ff'],
  ],
};

const TYPE_NOISE_MODES = {
  nebula: 'domain-warping',
  desert: 'vertical-stripes',
  triplex: 'gradation',
  toxic: 'vertical-stripes',
  gaia: 'simplex',
  volcanic: 'ridged',
  'gas-giant': 'horizontal-stripes',
  rocky: 'ridged',
  oceanic: 'domain-warping',
  void: 'domain-warping',
} as const satisfies Readonly<Record<PlanetTypeId, NoiseMode>>;

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
): PlanetRenderDescriptor {
  if (!isPlanetType(planetType)) throw new RangeError('Unsupported Planet Type.');
  const rng = namedVisualRandom(base.seed, `type:${planetType}`);
  const presets = TYPE_PALETTES[planetType];
  const preset = presets[rng.weightedIndex(presets.map(() => 1))];
  if (!preset) throw new Error('Type palette preset is missing.');
  const palette = jitterPalette(preset, rng);
  const colors: PlanetColors = {
    ...base.traits.colors,
    planet: palette.slice(0, 3),
    satellite: base.traits.colors.satellite,
  };
  let paletteType = base.traits.paletteType;
  let baseHue = base.traits.baseHue;
  let diameter = base.traits.diameter;
  // Gradation belongs exclusively to Triplex. Explicit type modes also keep the
  // visual identity independent from the source palette's generic noise selection.
  let noiseMode: NoiseMode = TYPE_NOISE_MODES[planetType];
  let hasClouds = base.traits.hasClouds;
  let cloudNoiseMode = base.traits.cloudNoiseMode;
  let cloudWeights = base.traits.cloudWeights;
  let cloudDirection: 1 | -1 | undefined;
  let cloudLapMs = base.traits.cloudLapMs;
  let mainLapMs = base.traits.mainLapMs;
  let hasRing = base.traits.hasRing;
  let satellites = base.traits.satellites;
  if (planetType === 'gas-giant') {
    diameter = Math.round(diameter * 1.3);
    // Gas Giants have broad, ponderous bands: never allow a faster-than-seven-second turn.
    mainLapMs = Math.max(7_000, Math.round(mainLapMs * 1.8));
    hasClouds = true;
    const gasCloudModes = ['horizontal-stripes', 'domain-warping', 'simplex'] as const;
    cloudNoiseMode = gasCloudModes[rng.weightedIndex([5, 3, 2])] ?? 'horizontal-stripes';
    cloudLapMs = Math.round(mainLapMs * 1.6);
    cloudWeights = [
      [1, 8, 1],
      [1, 6, 1],
      [1, 7, 2],
    ][rng.weightedIndex([4, 4, 2])] ?? [1, 8, 1];
    colors.cloud = [palette[3] ?? '#fff3d1', palette[1] ?? '#8c5a3c'];
    hasRing = rng.weightedIndex([3, 7]) === 1;
    if (hasRing) {
      satellites = deriveSatellites(rng, diameter, colors, true);
    } else {
      const sourceSatellites = deriveSatellites(rng, diameter, colors, false);
      satellites = Array.from({ length: rng.int(5, 12) }, (_, index) => {
        const satellite = sourceSatellites[index % sourceSatellites.length];
        if (!satellite) throw new Error('Gas Giant requires a source satellite.');
        return {
          ...satellite,
          diameter: rng.int(2, 7),
          speed: round(rng.float(0.28, 0.82)),
        };
      });
    }
    noiseMode = 'horizontal-stripes';
  }
  if (planetType === 'nebula') {
    const nebulaHues = [250, 315, 30, 190] as const;
    baseHue = nebulaHues[rng.weightedIndex([3, 3, 2, 2])] ?? 250;
    colors.planet = [
      color(rng, baseHue, 60, 90),
      color(rng, shiftedHue(baseHue, 15), 65, 75),
      color(rng, shiftedHue(baseHue, 30), 70, 60),
    ];
    colors.cloud = [
      color(rng, baseHue + 180, 35, 100, 12, 8, 0),
      color(rng, baseHue + 180, 45, 78, 12, 8, 0),
    ];
    paletteType = 'analogous';
    const nebulaNoiseModes = [
      'domain-warping',
      'simplex',
      'vertical-stripes',
      'horizontal-stripes',
    ] as const;
    noiseMode = nebulaNoiseModes[rng.weightedIndex([4, 3, 2, 2])] ?? 'domain-warping';
    hasClouds = true;
    cloudNoiseMode = rng.weightedIndex([3, 2]) === 0 ? 'simplex' : 'domain-warping';
    // Nebula clouds are a separate, visibly faster band drifting over the surface.
    cloudDirection = rng.weightedIndex([3, 1]) === 1 ? -1 : 1;
    if (cloudDirection === -1) mainLapMs = Math.round(mainLapMs * 1.65);
    cloudLapMs = Math.round(mainLapMs * rng.float(0.8, 0.98));
    cloudWeights = [2, 3, 3];
    colors.cloud = ['#fff1a8', '#ff3ea5'];
  }
  if (planetType === 'volcanic') {
    noiseMode = 'ridged';
    hasClouds = rng.weightedIndex([3, 1]) === 1;
    cloudNoiseMode = hasClouds ? 'domain-warping' : null;
    cloudLapMs = hasClouds ? Math.round(mainLapMs * 2.2) : null;
    colors.cloud = ['#d4d4d4', '#525252'];
    const ashSatellites = jitterPalette(['#525252', '#9a9a9a', '#c4c4c4'], rng);
    colors.satellite = [ashSatellites[0] ?? '#525252', ashSatellites[1] ?? '#9a9a9a'];
    hasRing = false;
    satellites = base.traits.satellites
      .slice(0, rng.int(1, 6))
      .map((satellite) => ({ ...satellite, rotation: rng.int(-90, 91) }));
  }
  if (planetType === 'oceanic') {
    noiseMode = 'domain-warping';
    hasClouds = true;
    cloudNoiseMode = rng.weightedIndex([3, 2]) === 0 ? 'simplex' : 'domain-warping';
    cloudLapMs = Math.round(mainLapMs * rng.float(1.3, 1.75));
    cloudWeights = [2, 5, 2];
    colors.cloud = ['#f0f9ff', '#7dd3fc'];
  }
  if (planetType === 'rocky') {
    diameter = Math.round(diameter * 0.9);
    noiseMode = 'ridged';
    hasClouds = false;
    cloudNoiseMode = null;
    cloudLapMs = null;
    hasRing = false;
    satellites = base.traits.satellites
      .slice(0, rng.weightedIndex([4, 4, 2]))
      .map((satellite, index) => ({
        ...satellite,
        color: palette[(index + 1) % palette.length] ?? '#777b75',
        speed: round(rng.float(0.025, 0.08)),
      }));
  }
  if (planetType === 'desert') {
    const desertNoiseModes = [
      'vertical-stripes',
      'horizontal-stripes',
      'ridged',
      'domain-warping',
    ] as const;
    noiseMode = desertNoiseModes[rng.weightedIndex([4, 3, 2, 1])] ?? 'vertical-stripes';
  }
  if (planetType === 'triplex') {
    colors.planet = preset.slice(0, 3);
    paletteType = 'split-complementary';
  }
  if (planetType === 'toxic') {
    colors.planet = preset.slice(0, 3);
    const toxicNoiseModes = ['vertical-stripes', 'horizontal-stripes', 'domain-warping'] as const;
    noiseMode = toxicNoiseModes[rng.weightedIndex([4, 4, 2])] ?? 'horizontal-stripes';
    paletteType = 'complementary';
    hasClouds = false;
    cloudNoiseMode = null;
    cloudLapMs = null;
  }
  if (planetType === 'gaia') {
    hasRing = false;
    const graySatellites = jitterPalette(['#707070', '#a0a0a0', '#d0d0d0'], rng);
    colors.satellite = [graySatellites[0] ?? '#707070', graySatellites[1] ?? '#a0a0a0'];
  }
  if (planetType === 'void') {
    baseHue = rng.int(0, 360);
    paletteType = 'cavity';
    const cavityColor = color(rng, baseHue, 60, 90);
    colors.planet = [null, cavityColor, null];
    colors.cloud = [
      color(rng, baseHue, 10, 100, 20, 10, 0),
      color(rng, baseHue, 10, 80, 20, 10, 0),
    ];
    colors.background = color(rng, baseHue + 180, 15, 15, 20, 0, 0);
    colors.satellite = createSatelliteColors('cavity', baseHue, colors.planet, colors.cloud, rng);
    colors.star = [
      color(rng, baseHue + 180, 10, 100, 20, 0, 0),
      color(rng, baseHue + 180, 20, 40, 20, 0, 0),
    ];
    hasClouds = false;
    cloudNoiseMode = null;
    cloudLapMs = null;
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
    hasRing,
    satellites,
    planetType,
  } as const;
  return { ...base, traits };
}

function derivePlanetVisualFromSeed(
  normalized: NormalizedPlanetVisualInput,
  seed: Hex,
): PlanetRenderDescriptor {
  const paletteRng = namedVisualRandom(seed, 'palette');
  const terrainRng = namedVisualRandom(seed, 'terrain');
  const satelliteRng = namedVisualRandom(seed, 'satellites');
  const satelliteColorRng = namedVisualRandom(seed, 'satellite-colors');
  const backgroundRng = namedVisualRandom(seed, 'background');

  const paletteWeights = getPaletteWeights(normalized.bonusBall);
  const paletteIndex = paletteRng.weightedIndex(paletteWeights);
  const paletteType = GENERATOR_CONFIG.paletteTypes[paletteIndex];
  if (!paletteType) throw new Error('Palette selection exceeded configured palette types.');
  const baseHue = paletteRng.int(0, 360);
  const colors = createColors(paletteType, baseHue, paletteRng, backgroundRng, satelliteColorRng);

  const firstDiameter = terrainRng.int(
    GENERATOR_CONFIG.planetDiameter.min,
    GENERATOR_CONFIG.planetDiameter.maxExclusive,
  );
  const secondDiameter = terrainRng.int(
    GENERATOR_CONFIG.planetDiameter.min,
    GENERATOR_CONFIG.planetDiameter.maxExclusive,
  );
  const diameter = Math.max(firstDiameter, secondDiameter);
  const noiseGroup = Math.floor(paletteIndex / 2);
  const noiseWeights = GENERATOR_CONFIG.noiseWeights[noiseGroup];
  if (!noiseWeights) throw new Error('Palette has no terrain distribution.');
  const noiseMode = GENERATOR_CONFIG.noiseModes[terrainRng.weightedIndex(noiseWeights)];
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
    GENERATOR_CONFIG.starCount.min,
    GENERATOR_CONFIG.starCount.maxExclusive,
  );

  const traits = {
    generatorVersion: GENERATOR_VERSION,
    paletteType,
    typePalette: colors.planet.filter((color): color is HexColor => color !== null),
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
  );
  const rng = namedVisualRandom(seed, `canonical-visual:${planetType}`);
  const palette = jitterPalette(options.palette.colors, rng);
  const colors: PlanetColors = {
    ...visual.traits.colors,
    planet: palette.slice(0, 3),
  };
  colors.satellite = createSatelliteColors(
    visual.traits.paletteType,
    visual.traits.baseHue,
    colors.planet,
    colors.cloud,
    rng,
  );
  const satellites = deriveSatellites(
    namedVisualRandom(seed, 'canonical-satellites'),
    visual.traits.diameter,
    colors,
    options.hasRing,
    options.satelliteCount,
  );
  return {
    ...visual,
    traits: {
      ...visual.traits,
      colors,
      typePalette: [...options.palette.colors],
      noiseMode: options.terrain,
      hasRing: options.hasRing,
      satellites,
    },
  };
}
