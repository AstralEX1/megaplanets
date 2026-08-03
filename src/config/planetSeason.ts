import { createSeason1Config, type SeasonConfig } from '@megaplanets/planet-generator';

function loadPlanetSeason(): SeasonConfig | null {
  const seasonId = (import.meta.env.VITE_PLANET_SEASON_ID as string | undefined)?.trim();
  if (!seasonId) return null;
  return createSeason1Config(seasonId as `0x${string}`);
}

/** Fail closed until deployment supplies the immutable on-chain Season identifier. */
export const PLANET_SEASON = loadPlanetSeason();
