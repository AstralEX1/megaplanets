import { deserializePlanetInput, serializePlanetInput } from './input';
import { verifyPlanetDescriptor } from './integrity';
import type { PlanetConfig, PlanetDescriptor, SerializedPlanetInput } from './types';

export type SerializedPlanetDescriptor = Omit<PlanetDescriptor, 'input'> & {
  input: SerializedPlanetInput;
};

export function serializePlanetDescriptor(
  descriptor: PlanetDescriptor,
): SerializedPlanetDescriptor {
  return { ...descriptor, input: serializePlanetInput(descriptor.input) };
}

export function deserializePlanetDescriptor(
  descriptor: SerializedPlanetDescriptor,
  config: PlanetConfig,
): PlanetDescriptor {
  return verifyPlanetDescriptor(
    { ...descriptor, input: deserializePlanetInput(descriptor.input) },
    config,
  );
}
