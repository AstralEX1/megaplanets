import { deepFreeze } from './immutable';
import { verifyPlanetDescriptor } from './integrity';
import type { PlanetDescriptor, PlanetMetadata, SeasonConfig } from './types';

/** Builds public metadata in the Season 1 schema order plus non-attribute audit provenance. */
export function buildPlanetMetadata(
  descriptor: PlanetDescriptor,
  config: SeasonConfig,
): PlanetMetadata {
  const { input, seed, traits, traitsHash } = verifyPlanetDescriptor(descriptor, config);
  return deepFreeze({
    name: traits.name,
    description: `MegaPlanet ${traits.name} from Season ${traits.season}.`,
    attributes: [
      { trait_type: 'Name', value: traits.name },
      { trait_type: 'Type', value: traits.type },
      { trait_type: 'Satellites', value: traits.satelliteCount },
      { trait_type: 'Minerals', value: traits.minerals },
      { trait_type: 'Rarity', value: traits.rarity },
      { trait_type: 'Season', value: traits.season },
      { trait_type: 'Seed', value: seed },
    ],
    provenance: {
      ticketId: input.ticketId.toString(),
      drawingId: input.drawingId.toString(),
      originTxHash: input.originTxHash,
      seasonId: input.seasonId,
      specialEditionId: null,
      traitsHash,
    },
  });
}
