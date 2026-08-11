import { keccak256, stringToHex } from 'viem';
import {
  derivePlanet,
  deriveTypePalette,
  deriveTypeSatellites,
  deriveTypeTerrain,
} from './generator';
import { deepFreeze } from './immutable';
import type { PlanetInput, PlanetPreview, PlanetConfig } from './types';
import { derivePlanetVisualForType } from './visual-traits';
import { isPlanetType, type PlanetTypeId } from './visual-types';

function derivePreview(
  input: PlanetInput,
  config: PlanetConfig,
  forcedType?: PlanetTypeId,
): PlanetPreview {
  const descriptor = derivePlanet(input, config);
  const typeId = forcedType ?? descriptor.traits.typeId;
  if (!isPlanetType(typeId)) {
    throw new RangeError(`Type "${typeId}" is not supported by the animated renderer.`);
  }
  const type = config.types.find((candidate) => candidate.id === typeId);
  if (!type) throw new RangeError(`Type "${typeId}" is not configured.`);
  const terrain = forcedType ? deriveTypeTerrain(descriptor.seed, type) : descriptor.traits.terrain;
  const satellites = forcedType
    ? deriveTypeSatellites(descriptor.seed, type)
    : {
        satelliteCount: descriptor.traits.satelliteCount,
        hasRing: descriptor.traits.hasRing,
      };
  const visual = derivePlanetVisualForType(
    {
      ticketId: descriptor.input.ticketId,
      drawingId: descriptor.input.drawingId,
      normals: descriptor.input.normals,
      bonusBall: descriptor.input.bonusBall,
    },
    typeId,
    descriptor.seed,
    {
      palette: forcedType ? deriveTypePalette(descriptor.seed, type) : descriptor.traits.palette,
      terrain,
      satelliteCount: satellites.satelliteCount,
      hasRing: satellites.hasRing,
      profile: type.visual,
    },
  );
  const canonicalVisualTraitsJson = JSON.stringify(visual.traits);
  return deepFreeze({
    descriptor,
    visual,
    canonicalVisualTraitsJson,
    visualTraitsHash: keccak256(stringToHex(canonicalVisualTraitsJson)),
  });
}

/** Canonical Planet preview. Type always comes from the weighted selection. */
export function derivePlanetPreview(input: PlanetInput, config: PlanetConfig): PlanetPreview {
  return derivePreview(input, config);
}

/** Lab-only visual override. It must never be used to create canonical NFT metadata. */
export function derivePlanetPreviewForType(
  input: PlanetInput,
  config: PlanetConfig,
  type: PlanetTypeId,
): PlanetPreview {
  if (!isPlanetType(type)) throw new RangeError('Unsupported Planet Type.');
  return derivePreview(input, config, type);
}
