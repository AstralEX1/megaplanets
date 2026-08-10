import { createSeason1Config, type SeasonConfig } from '@megaplanets/planet-generator';
import { CHAIN } from './contracts';

/** Matches `MegaPlanets.seasonId()` on the deployed Base Sepolia Season 1 contract. */
export const BASE_SEPOLIA_SEASON_1_ID =
  '0xee23bca2927e52eeb944320241d7a6e41726dcb3f169d972044bdafe95b4b15b' as const;

function loadPlanetSeason(): SeasonConfig | null {
  const configuredSeasonId = (import.meta.env.VITE_PLANET_SEASON_ID as string | undefined)?.trim();
  const seasonId = configuredSeasonId ?? (CHAIN === 'testnet' ? BASE_SEPOLIA_SEASON_1_ID : undefined);
  if (!seasonId) return null;
  return createSeason1Config(seasonId as `0x${string}`);
}

/** Base Sepolia Season 1 is safe to render without a local env file; other chains still fail closed. */
export const PLANET_SEASON = loadPlanetSeason();
