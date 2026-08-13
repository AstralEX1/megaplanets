import { describe, expect, it } from 'vitest';
import { parsePlanetHoldingsSource } from './planetConfig';

describe('Planet holdings source', () => {
  it('defaults to automatic direct-chain ownership', () => {
    expect(parsePlanetHoldingsSource(undefined)).toBe('auto');
    expect(parsePlanetHoldingsSource(' direct ')).toBe('direct');
  });

  it('allows indexed reads only as an explicit rollback mode', () => {
    expect(parsePlanetHoldingsSource('indexed')).toBe('indexed');
    expect(() => parsePlanetHoldingsSource('backend')).toThrow(/VITE_PLANET_HOLDINGS_SOURCE/);
  });
});
