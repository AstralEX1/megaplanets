import { derivePlanet } from './generator';
import type { PlanetConfig, PlanetDescriptor } from './types';

/** Re-derives a descriptor and rejects any substituted seed, trait, or integrity hash. */
export function verifyPlanetDescriptor(
  descriptor: PlanetDescriptor,
  config: PlanetConfig,
): PlanetDescriptor {
  const canonical = derivePlanet(descriptor.input, config);
  if (
    descriptor.seed.toLowerCase() !== canonical.seed ||
    descriptor.canonicalTraitsJson !== canonical.canonicalTraitsJson ||
    descriptor.traitsHash.toLowerCase() !== canonical.traitsHash ||
    JSON.stringify(descriptor.traits) !== canonical.canonicalTraitsJson
  ) {
    throw new Error('Planet descriptor failed canonical integrity validation.');
  }
  return canonical;
}
