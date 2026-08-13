import { createPlanetConfig } from '@megaplanets/planet-generator';

/** Deterministic V3 generation is independent of deployment/runtime contract configuration. */
export const PLANET_CONFIG = createPlanetConfig();

export type PlanetHoldingsSource = 'auto' | 'direct' | 'indexed';

/**
 * Selects the current Planet ownership reader. `auto` is the safe default: the
 * direct chain reader is authoritative whenever the contract is configured;
 * `indexed` is retained only as an explicit rollback switch.
 */
export function parsePlanetHoldingsSource(value: string | undefined): PlanetHoldingsSource {
  const source = value?.trim().toLowerCase();
  if (!source) return 'auto';
  if (source === 'auto' || source === 'direct' || source === 'indexed') return source;
  throw new Error('VITE_PLANET_HOLDINGS_SOURCE must be "auto", "direct", or "indexed".');
}

export const PLANET_HOLDINGS_SOURCE = parsePlanetHoldingsSource(
  import.meta.env.VITE_PLANET_HOLDINGS_SOURCE,
);
