import type { Hex, HexColor, PlanetRenderDescriptor } from './visual-types';

export const GENERATOR_VERSION = 2 as const;

export type PlanetRarity = 'Common' | 'Uncommon' | 'Epic' | 'Legendary';

export type PlanetInput = {
  seasonId: Hex;
  ticketId: bigint;
  drawingId: bigint;
  normals: readonly number[];
  bonusBall: number;
  originTxHash: Hex;
};

export type NormalizedPlanetInput = Omit<PlanetInput, 'normals'> & {
  normals: readonly [number, number, number, number, number];
};

export type SerializedPlanetInput = {
  seasonId: Hex;
  ticketId: string;
  drawingId: string;
  normals: readonly number[];
  bonusBall: number;
  originTxHash: Hex;
};

export type MineralsSubrange = {
  min: number;
  max: number;
  weight: number;
};

export type RarityConfig = {
  rarity: PlanetRarity;
  weight: number;
  min: number;
  max: number;
  subranges: readonly MineralsSubrange[];
};

export type TerrainMode =
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
  | 'polar-caps'
  | 'pixel-continents'
  | 'archipelago'
  | 'pixel-mountain-ridges'
  | 'spiral-currents';

export type TypePalette = {
  name?: string;
  colors: readonly [HexColor, HexColor, HexColor, ...HexColor[]];
  coolorsUrl: string;
};

export type SatelliteDistribution = {
  kind: 'none' | 'one' | 'moons' | 'ring';
  min: number;
  max: number;
  weight: number;
};

export type TypeVisualProfile = {
  /** Void derives the original source Cavity colors instead of selecting fixed swatches. */
  paletteMode: 'variants' | 'original-cavity';
  paletteVariants: readonly TypePalette[];
  terrainWeights: readonly { mode: TerrainMode; weight: number }[];
  cloudStyle: 'standard' | 'ash' | 'oceanic' | 'nebula' | 'gas-giant' | 'gaia' | 'none';
  satelliteStyle: 'standard' | 'ash' | 'gray' | 'rocky' | 'gas-giant' | 'cavity';
  satellites: readonly SatelliteDistribution[];
  diameterMultiplier: number;
  mainLapMultiplier: number;
  minimumMainLapMs?: number;
};

/** An owner-approved public Type and its deterministic visual profile. */
export type TypeConfig = {
  id: string;
  publicName: string;
  visual: TypeVisualProfile;
};

export type TypeWeightProfile = {
  id: string;
  weights: readonly number[];
};

export type SeasonConfig = {
  seasonId: Hex;
  season: number;
  types: readonly TypeConfig[];
  typeWeightProfiles: readonly TypeWeightProfile[];
  rarity: readonly RarityConfig[];
};

export type PlanetTraits = {
  name: string;
  typeId: string;
  type: string;
  terrain: TerrainMode;
  palette: TypePalette;
  satelliteCount: number;
  hasRing: boolean;
  minerals: number;
  rarity: PlanetRarity;
  season: number;
  specialEditionId: null;
};

export type PlanetDescriptor = {
  input: NormalizedPlanetInput;
  seed: Hex;
  traits: PlanetTraits;
  canonicalTraitsJson: string;
  traitsHash: Hex;
};

export type PlanetPreview = {
  descriptor: PlanetDescriptor;
  visual: PlanetRenderDescriptor;
  canonicalVisualTraitsJson: string;
  visualTraitsHash: Hex;
};

export type MetadataAttribute = {
  trait_type: 'Name' | 'Type' | 'Satellites' | 'Minerals' | 'Rarity' | 'Season' | 'Seed';
  value: string | number;
};

export type PlanetMetadata = {
  name: string;
  description: string;
  attributes: readonly MetadataAttribute[];
  provenance: {
    ticketId: string;
    drawingId: string;
    originTxHash: Hex;
    seasonId: Hex;
    specialEditionId: null;
    traitsHash: Hex;
  };
};
