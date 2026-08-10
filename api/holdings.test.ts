import { describe, expect, it } from 'vitest';
import { parsePlanetMetadata, reconstructPlanetOwners, type PlanetTransfer } from './holdings';

const alice = '0x1111111111111111111111111111111111111111' as const;
const bob = '0x2222222222222222222222222222222222222222' as const;
const zero = '0x0000000000000000000000000000000000000000' as const;

function transfer(from: PlanetTransfer['from'], to: PlanetTransfer['to'], blockNumber: bigint, logIndex: bigint): PlanetTransfer {
  return { from, to, tokenId: 7n, blockNumber, logIndex };
}

describe('Planet holdings', () => {
  it('uses the owner after a transfer before the recorded snapshot block', () => {
    const owners = reconstructPlanetOwners([transfer(zero, alice, 10n, 1n), transfer(alice, bob, 12n, 3n)]);
    expect(owners.get(7n)).toBe(bob);
  });

  it('does not include burned Planet NFTs', () => {
    const owners = reconstructPlanetOwners([transfer(zero, alice, 10n, 1n), transfer(alice, zero, 11n, 1n)]);
    expect(owners.has(7n)).toBe(false);
  });

  it('parses only the immutable scoring attributes', () => {
    expect(parsePlanetMetadata({ attributes: [{ trait_type: 'Type', value: 'Nebula' }, { trait_type: 'Minerals', value: 42 }] })).toEqual({ planetType: 'Nebula', minerals: 42n });
    expect(() => parsePlanetMetadata({ attributes: [{ trait_type: 'Type', value: 'Nebula' }] })).toThrow('Minerals');
  });
});
