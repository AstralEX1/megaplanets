import { encodeAbiParameters, keccak256 } from 'viem';
import { normalizePlanetInput } from './input';
import { GENERATOR_VERSION, type PlanetInput } from './types';
import type { Hex } from './visual-types';

export function derivePlanetSeed(input: PlanetInput): Hex {
  const normalized = normalizePlanetInput(input);
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'uint16', name: 'generatorVersion' },
        { type: 'uint256', name: 'ticketId' },
        { type: 'uint256', name: 'drawingId' },
        { type: 'uint8[5]', name: 'normals' },
        { type: 'uint8', name: 'bonusBall' },
        { type: 'bytes32', name: 'originTxHash' },
      ],
      [
        GENERATOR_VERSION,
        normalized.ticketId,
        normalized.drawingId,
        normalized.normals,
        normalized.bonusBall,
        normalized.originTxHash,
      ],
    ),
  );
}
