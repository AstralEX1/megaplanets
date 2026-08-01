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
  | 'gradation';

export type PlanetRarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | '42';

export type PlanetTicketInput = {
  ticketId: bigint;
  drawingId: bigint;
  normals: readonly number[];
  bonusBall: number;
};

export type NormalizedPlanetTicketInput = Omit<PlanetTicketInput, 'normals'> & {
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

export type PlanetTraits = {
  generatorVersion: number;
  paletteType: PaletteType;
  paletteProfile: number;
  paletteWeights: readonly number[];
  baseHue: number;
  colors: PlanetColors;
  noiseMode: NoiseMode;
  diameter: number;
  hasClouds: boolean;
  cloudNoiseMode: Extract<NoiseMode, 'simplex' | 'domain-warping'> | null;
  mainLapMs: number;
  cloudLapMs: number | null;
  hasRing: boolean;
  satellites: readonly SatelliteTrait[];
  starCount: number;
  rarity: PlanetRarity;
  dailyPoints: string;
  specialEditionId: null;
};

export type PlanetDescriptor = {
  input: NormalizedPlanetTicketInput;
  seed: Hex;
  dailyPoints: bigint;
  rarity: PlanetRarity;
  traits: PlanetTraits;
  canonicalTraitsJson: string;
  traitsHash: Hex;
};

export type PlanetFrame = {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};

export type SerializedPlanetTicketInput = {
  ticketId: string;
  drawingId: string;
  normals: readonly number[];
  bonusBall: number;
};

export type SerializedPlanetDescriptor = Omit<PlanetDescriptor, 'input' | 'dailyPoints'> & {
  input: SerializedPlanetTicketInput;
  dailyPoints: string;
};
