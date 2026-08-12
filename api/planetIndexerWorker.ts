import { getPrismaClient } from './database';
import { initializeMissingMiningStates } from './miningStore';
import { indexPlanetEvents, PrismaPlanetIndexStore } from './planetIndexer';
import type { Stage2Config } from './stage2Config';

/** Runs one bounded finalized cycle; it is never exposed through HTTP. */
export async function runPlanetIndexerCycle(config: Stage2Config) {
  if (!config.planetContractAddress) throw new Error('MegaPlanets contract configuration is required for mining/indexing.');
  const scope = { chainId: config.chainId, contractAddress: config.planetContractAddress };
  const prisma = getPrismaClient(config.databaseUrl);
  const planets = await indexPlanetEvents(config, new PrismaPlanetIndexStore(prisma));
  const miningStatesInitialized = await initializeMissingMiningStates(prisma, new Date(), scope);
  return { planets, miningStatesInitialized };
}
