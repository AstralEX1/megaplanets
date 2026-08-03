export type Hex = `0x${string}`;
export type HexColor = `#${string}`;

export type PaletteType =
  | 'analogous'
  | 'complementary'
  | 'split-complementary'
  | 'triad'
  | 'cavity'
  | 'earth';

export type NoiseMode =
  | 'simplex'
  | 'ridged'
  | 'domain-warping'
  | 'vertical-stripes'
  | 'horizontal-stripes'
  | 'gradation'
  | 'turbulence'
  | 'banded'
  | 'cratered'
  | 'ocean-currents'
  | 'cellular'
  | 'polar-caps';

export const PLANET_TYPES = [
  'nebula',
  'desert',
  'triplex',
  'toxic',
  'void',
  'gaia',
  'volcanic',
  'gas-giant',
  'rocky',
  'oceanic',
] as const;
export type PlanetTypeId = (typeof PLANET_TYPES)[number];

export function isPlanetType(value: unknown): value is PlanetTypeId {
  return typeof value === 'string' && (PLANET_TYPES as readonly string[]).includes(value);
}

export type PlanetVisualInput = {
  ticketId: bigint;
  drawingId: bigint;
  normals: readonly number[];
  bonusBall: number;
};

export type NormalizedPlanetVisualInput = Omit<PlanetVisualInput, 'normals'> & {
  normals: readonly [number, number, number, number, number];
};

export type SatelliteTrait = {
  diameter: number;
  color: HexColor;
  speed: number;
  orbitX: number;
  orbitY: number;
  initialAngle: number;
  rotation: number;
};
export type PlanetColors = {
  background: HexColor;
  planet: readonly (HexColor | null)[];
  cloud: readonly [HexColor, HexColor];
  satellite: readonly [HexColor, HexColor];
  star: readonly [HexColor, HexColor];
};

export type PlanetVisualTraits = {
  generatorVersion: number;
  paletteType: PaletteType;
  /** Canonical Type palette consumed by this render descriptor before deterministic jitter. */
  typePalette: readonly HexColor[];
  paletteProfile: number;
  paletteWeights: readonly number[];
  baseHue: number;
  colors: PlanetColors;
  noiseMode: NoiseMode;
  diameter: number;
  hasClouds: boolean;
  cloudNoiseMode: NoiseMode | null;
  cloudWeights?: readonly number[];
  /** Direction of the separate cloud sphere; -1 creates a counter-rotating layer. */
  cloudDirection?: 1 | -1;
  mainLapMs: number;
  cloudLapMs: number | null;
  hasRing: boolean;
  satellites: readonly SatelliteTrait[];
  starCount: number;
  specialEditionId: null;
  planetType?: PlanetTypeId;
};

/** Render-only data; scoring and public metadata live in the canonical descriptor. */
export type PlanetRenderDescriptor = {
  input: NormalizedPlanetVisualInput;
  seed: Hex;
  traits: PlanetVisualTraits;
};

export type PlanetFrame = {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};
