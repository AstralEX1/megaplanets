import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicClient, type Hex } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID } from './config';
import type { PrismaClient } from './generated/prisma/client';
import { indexPlanetEvents, PrismaPlanetIndexStore, type PlanetTransferEvent } from './planetIndexer';
import type { Stage2Config } from './stage2Config';

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return { ...actual, createPublicClient: vi.fn() };
});

const previousOwner = '0x0000000000000000000000000000000000000001' as const;
const nextOwner = '0x0000000000000000000000000000000000000002' as const;
const planetContract = '0x0000000000000000000000000000000000000003' as const;
const deploymentBlock = 45_347_860n;

function blockHash(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16).padStart(64, '0')}`;
}

describe('PrismaPlanetIndexStore ownership projection', () => {
  it('changes current ownership without writing the retired mining ledger', async () => {
    let currentOwner = previousOwner;
    const planet = { id: 'planet-1', ownerAddress: previousOwner, baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const transaction = {
      $queryRaw(this: unknown, strings: TemplateStringsArray, ..._values: unknown[]) {
        expect(this).toBe(transaction);
        expect(strings.join('?')).toContain('SELECT 1 AS locked');
        return Promise.resolve();
      },
      planet: {
        findUnique: async () => ({ ...planet, ownerAddress: currentOwner }),
        update: async ({ data }: { data: { ownerAddress: typeof previousOwner } }) => {
          currentOwner = data.ownerAddress;
        },
      },
      planetOwnershipHistory: { create: async () => undefined },
      processedBlockchainEvent: { create: async () => undefined },
    };
    const prisma = {
      processedBlockchainEvent: { findUnique: async () => null },
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient;
    const event: PlanetTransferEvent = {
      chainId: BASE_SEPOLIA_CHAIN_ID,
      contractAddress: planetContract,
      tokenId: 42n,
      from: previousOwner,
      to: nextOwner,
      transactionHash: `0x${'44'.repeat(32)}`,
      blockNumber: 42n,
      blockHash: `0x${'55'.repeat(32)}`,
      logIndex: 7,
      blockTimestamp: new Date('2026-08-10T00:00:01.000Z'),
    };

    await new PrismaPlanetIndexStore(prisma).recordTransfer(event);

    expect(currentOwner).toBe(nextOwner);
  });
});

describe('PrismaPlanetIndexStore reorg resets', () => {
  it('rewinds deployment-scoped derived state in FK-safe order before resetting the cursor', async () => {
    const calls: string[] = [];
    const transaction = {
      planetOwnershipHistory: {
        findMany: async () => [],
        deleteMany: async () => { calls.push('planetOwnershipHistory.deleteMany'); },
      },
      processedBlockchainEvent: { deleteMany: async () => { calls.push('processedBlockchainEvent.deleteMany'); } },
      planet: {
        findMany: async () => [],
        deleteMany: async () => { calls.push('planet.deleteMany'); },
        findUnique: async () => null,
        update: async () => undefined,
      },
      indexerCursor: { updateMany: async () => { calls.push('indexerCursor.updateMany'); } },
    };
    const prisma = {
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient;

    await new PrismaPlanetIndexStore(prisma).rewind(planetContract, deploymentBlock);

    expect(calls).toEqual([
      'planetOwnershipHistory.deleteMany',
      'processedBlockchainEvent.deleteMany',
      'planet.deleteMany',
      'indexerCursor.updateMany',
    ]);
  });
});

describe('planet indexer cursor hashing', () => {
  const config: Stage2Config = {
    databaseUrl: 'postgresql://not-used-in-tests',
    rpcUrl: 'https://rpc.example.test',
    rpcFallbackUrls: [],
    chainId: BASE_SEPOLIA_CHAIN_ID,
    planetContractAddress: planetContract,
    planetDeploymentBlock: deploymentBlock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replays from the deployment block when the stored cursor hash no longer matches canon', async () => {
    const client = {
      getBlockNumber: vi.fn().mockResolvedValue(deploymentBlock + 46n),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
        hash: blockHash(blockNumber),
        timestamp: 1n,
      })),
      getLogs: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(createPublicClient).mockReturnValue(client as never);

    const store = {
      getCursor: vi.fn().mockResolvedValue({
        nextBlock: deploymentBlock + 40n,
        lastBlockHash: blockHash(999n),
      }),
      setCursor: vi.fn().mockResolvedValue(undefined),
      rewind: vi.fn().mockResolvedValue(undefined),
      getTicketInput: vi.fn(),
      recordMinted: vi.fn(),
      recordTransfer: vi.fn(),
    };

    const result = await indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
    });

    expect(store.rewind).toHaveBeenCalledWith(planetContract, deploymentBlock + 28n);
    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: planetContract,
        fromBlock: deploymentBlock + 28n,
        toBlock: deploymentBlock + 40n,
      }),
    );
    expect(result).toMatchObject({
      fromBlock: deploymentBlock + 28n,
      throughBlock: deploymentBlock + 40n,
      eventsProcessed: 0,
      reorgDetected: true,
    });
  });
});
