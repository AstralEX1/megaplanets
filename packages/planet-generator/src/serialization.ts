import type {
  PlanetDescriptor,
  PlanetTicketInput,
  SerializedPlanetDescriptor,
  SerializedPlanetTicketInput,
} from './types';

export function serializePlanetInput(input: PlanetTicketInput): SerializedPlanetTicketInput {
  return {
    ticketId: input.ticketId.toString(),
    drawingId: input.drawingId.toString(),
    normals: [...input.normals],
    bonusBall: input.bonusBall,
  };
}

export function deserializePlanetInput(input: SerializedPlanetTicketInput): PlanetTicketInput {
  return {
    ticketId: BigInt(input.ticketId),
    drawingId: BigInt(input.drawingId),
    normals: [...input.normals],
    bonusBall: input.bonusBall,
  };
}

export function serializePlanetDescriptor(
  descriptor: PlanetDescriptor,
): SerializedPlanetDescriptor {
  return {
    ...descriptor,
    input: serializePlanetInput(descriptor.input),
    dailyPoints: descriptor.dailyPoints.toString(),
  };
}

export function deserializePlanetDescriptor(
  descriptor: SerializedPlanetDescriptor,
): PlanetDescriptor {
  return {
    ...descriptor,
    input: {
      ...deserializePlanetInput(descriptor.input),
      normals: [...descriptor.input.normals].sort((left, right) => left - right) as [
        number,
        number,
        number,
        number,
        number,
      ],
    },
    dailyPoints: BigInt(descriptor.dailyPoints),
  };
}
