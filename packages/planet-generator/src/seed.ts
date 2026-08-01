import { encodeAbiParameters, keccak256 } from 'viem';
import { GENERATOR_VERSION } from './config';
import type { Hex, NormalizedPlanetTicketInput, PlanetTicketInput } from './types';

const UINT256_MAX = (1n << 256n) - 1n;

export function normalizePlanetInput(input: PlanetTicketInput): NormalizedPlanetTicketInput {
  if (input.ticketId <= 0n || input.ticketId > UINT256_MAX) {
    throw new RangeError('ticketId must be a positive uint256.');
  }
  if (input.drawingId <= 0n || input.drawingId > UINT256_MAX) {
    throw new RangeError('drawingId must be a positive uint256.');
  }
  if (!Number.isInteger(input.bonusBall) || input.bonusBall < 1 || input.bonusBall > 255) {
    throw new RangeError('bonusBall must be an integer between 1 and 255.');
  }
  if (input.normals.length !== 5) throw new RangeError('Exactly five normal balls are required.');

  const normals = [...input.normals].sort((left, right) => left - right);
  if (new Set(normals).size !== 5) throw new RangeError('Normal balls must be unique.');
  if (normals.some((normal) => !Number.isInteger(normal) || normal < 1 || normal > 255)) {
    throw new RangeError('Normal balls must be integers between 1 and 255.');
  }

  return {
    ticketId: input.ticketId,
    drawingId: input.drawingId,
    normals: normals as [number, number, number, number, number],
    bonusBall: input.bonusBall,
  };
}

export function derivePlanetSeed(input: PlanetTicketInput): Hex {
  const normalized = normalizePlanetInput(input);
  const encoded = encodeAbiParameters(
    [
      { type: 'uint16', name: 'generatorVersion' },
      { type: 'uint256', name: 'ticketId' },
      { type: 'uint256', name: 'drawingId' },
      { type: 'uint8[5]', name: 'normals' },
      { type: 'uint8', name: 'bonusBall' },
    ],
    [
      GENERATOR_VERSION,
      normalized.ticketId,
      normalized.drawingId,
      normalized.normals,
      normalized.bonusBall,
    ],
  );
  return keccak256(encoded);
}
