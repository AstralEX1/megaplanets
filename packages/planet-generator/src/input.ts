import type { NormalizedPlanetInput, PlanetInput, SerializedPlanetInput } from './types';
import type { Hex } from './visual-types';

const UINT256_MAX = (1n << 256n) - 1n;
const BYTES32_PATTERN = /^0x[\da-fA-F]{64}$/;

export function assertBytes32(value: string, field: string): asserts value is Hex {
  if (!BYTES32_PATTERN.test(value))
    throw new RangeError(`${field} must be a 0x-prefixed bytes32 hex value.`);
}

export function normalizePlanetInput(input: PlanetInput): NormalizedPlanetInput {
  if (input.ticketId <= 0n || input.ticketId > UINT256_MAX) {
    throw new RangeError('ticketId must be a positive uint256.');
  }
  if (input.drawingId <= 0n || input.drawingId > UINT256_MAX) {
    throw new RangeError('drawingId must be a positive uint256.');
  }
  assertBytes32(input.seasonId, 'seasonId');
  assertBytes32(input.originTxHash, 'originTxHash');
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
    seasonId: input.seasonId.toLowerCase() as Hex,
    ticketId: input.ticketId,
    drawingId: input.drawingId,
    normals: normals as [number, number, number, number, number],
    bonusBall: input.bonusBall,
    originTxHash: input.originTxHash.toLowerCase() as Hex,
  };
}

export function serializePlanetInput(input: PlanetInput): SerializedPlanetInput {
  const normalized = normalizePlanetInput(input);
  return {
    seasonId: normalized.seasonId,
    ticketId: normalized.ticketId.toString(),
    drawingId: normalized.drawingId.toString(),
    normals: [...normalized.normals],
    bonusBall: normalized.bonusBall,
    originTxHash: normalized.originTxHash,
  };
}

export function deserializePlanetInput(input: SerializedPlanetInput): NormalizedPlanetInput {
  return normalizePlanetInput({
    seasonId: input.seasonId,
    ticketId: BigInt(input.ticketId),
    drawingId: BigInt(input.drawingId),
    normals: [...input.normals],
    bonusBall: input.bonusBall,
    originTxHash: input.originTxHash,
  });
}
