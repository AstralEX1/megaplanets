import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID } from './config';
import { runPlanetIndexerCycle } from './planetIndexerWorker';
import type { Stage2Config } from './stage2Config';
import { indexEligibleTickets } from './indexer';
import { indexPlanetEvents } from './planetIndexer';
import { initializeMissingMiningStates } from './miningStore';

vi.mock('./database', () => ({ getPrismaClient: vi.fn(() => ({}) ) }));
vi.mock('./indexer', () => ({ indexEligibleTickets: vi.fn() }));
vi.mock('./planetIndexer', () => ({
  indexPlanetEvents: vi.fn(async () => ({ throughBlock: 10n, eventsProcessed: 0, reorgDetected: false })),
  PrismaPlanetIndexStore: class {},
}));
vi.mock('./miningStore', () => ({ initializeMissingMiningStates: vi.fn(async () => 0) }));
vi.mock('./prismaEligibilityStore', () => ({ PrismaEligibilityStore: class {} }));

const config: Stage2Config = {
  databaseUrl: 'postgresql://not-used-in-tests',
  rpcUrl: 'https://rpc.example.test',
  rpcFallbackUrls: [],
  appOrigin: 'http://127.0.0.1:5173',
  sessionTtlSeconds: 86_400,
  chainId: BASE_SEPOLIA_CHAIN_ID,
  planetContractAddress: '0x0000000000000000000000000000000000000003',
  planetDeploymentBlock: 1n,
};

describe('Planet indexer worker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not run the retired continuous Ticket indexer or advance its cursor', async () => {
    const result = await runPlanetIndexerCycle(config);

    expect(indexEligibleTickets).not.toHaveBeenCalled();
    expect(indexPlanetEvents).toHaveBeenCalledOnce();
    expect(initializeMissingMiningStates).toHaveBeenCalledOnce();
    expect(result).not.toHaveProperty('tickets');
  });
});
