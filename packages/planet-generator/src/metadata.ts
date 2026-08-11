import { deepFreeze } from './immutable';
import { verifyPlanetDescriptor } from './integrity';
import type { PlanetConfig, PlanetDescriptor, PlanetMetadata } from './types';

/** Builds public metadata plus non-attribute audit provenance. */
export function buildPlanetMetadata(
  descriptor: PlanetDescriptor,
  config: PlanetConfig,
): PlanetMetadata {
  const { input, seed, traits, traitsHash } = verifyPlanetDescriptor(descriptor, config);
  return deepFreeze({
    name: traits.name,
    description: `MegaPlanet ${traits.name}, deterministically generated from Megapot ticket #${input.ticketId}.`,
    attributes: [
      { trait_type: 'Name', value: traits.name },
      { trait_type: 'Type', value: traits.type },
      { trait_type: 'Satellites', value: traits.satelliteCount },
      { trait_type: 'Minerals', value: traits.minerals },
      { trait_type: 'Rarity', value: traits.rarity },
      { trait_type: 'Seed', value: seed },
    ],
    provenance: {
      ticketId: input.ticketId.toString(),
      drawingId: input.drawingId.toString(),
      originTxHash: input.originTxHash,
      specialEditionId: null,
      traitsHash,
    },
  });
}
