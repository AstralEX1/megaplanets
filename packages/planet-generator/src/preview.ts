import { keccak256, stringToHex } from 'viem';
import { derivePlanet } from './generator';
import { deepFreeze } from './immutable';
import type { PlanetInput, PlanetPreview, SeasonConfig } from './types';
import { derivePlanetVisualForType } from './visual-traits';
import { isPlanetType, type PlanetTypeId } from './visual-types';

function derivePreview(
  input: PlanetInput,
  config: SeasonConfig,
  forcedType?: PlanetTypeId,
): PlanetPreview {
  const descriptor = derivePlanet(input, config);
  const typeId = forcedType ?? descriptor.traits.typeId;
  if (!isPlanetType(typeId)) {
    throw new RangeError(`Type "${typeId}" is not supported by the animated renderer.`);
  }
  const type = config.types.find((candidate) => candidate.id === typeId);
  if (!type) throw new RangeError(`Type "${typeId}" is not configured for this Season.`);
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
      palette: type.palette,
      terrain: forcedType
        ? (type.terrainWeights[0]?.mode ?? descriptor.traits.terrain)
        : descriptor.traits.terrain,
      satelliteCount: descriptor.traits.satelliteCount,
      hasRing: descriptor.traits.hasRing,
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

/** Canonical Season preview. Type always comes from the weighted selection. */
export function derivePlanetPreview(input: PlanetInput, config: SeasonConfig): PlanetPreview {
  return derivePreview(input, config);
}

/** Lab-only visual override. It must never be used to create canonical NFT metadata. */
export function derivePlanetPreviewForType(
  input: PlanetInput,
  config: SeasonConfig,
  type: PlanetTypeId,
): PlanetPreview {
  if (!isPlanetType(type)) throw new RangeError('Unsupported Planet Type.');
  return derivePreview(input, config, type);
}
