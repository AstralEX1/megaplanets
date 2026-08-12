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

describe('PrismaPlanetIndexStore mining settlements', () => {
  it('settles a transferred Planet for the previous owner before changing ownership', async () => {
    let currentOwner = previousOwner;
    const accrualState = {
      planetId: 'planet-1',
      ownerAddress: previousOwner,
      startedAt: new Date('2026-08-10T00:00:00.000Z'),
      multiplierBps: 10_000,
      remainder: 0n,
    };
    const ledger: Array<{ ownerAddress: string; amountMicros: bigint }> = [];
    const planet = { id: 'planet-1', ownerAddress: previousOwner, baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const transaction = {
      $queryRaw(this: unknown, strings: TemplateStringsArray, ..._values: unknown[]) {
        expect(this).toBe(transaction);
        expect(strings.join('?')).toContain('SELECT 1 AS locked');
        return Promise.resolve();
      },
      planet: {
        findUnique: async () => ({ ...planet, ownerAddress: currentOwner }),
        findMany: async ({ where }: { where: { ownerAddress: string } }) =>
          where.ownerAddress === currentOwner ? [planet] : [],
        update: async ({ data }: { data: { ownerAddress: typeof previousOwner } }) => {
          currentOwner = data.ownerAddress;
        },
      },
      planetOwnershipHistory: { create: async () => undefined },
      planetAccrualState: {
        findMany: async () => [accrualState],
        create: async () => undefined,
        update: async ({ data }: { data: Partial<typeof accrualState> }) => Object.assign(accrualState, data),
        updateMany: async ({ data }: { data: Partial<typeof accrualState> }) => Object.assign(accrualState, data),
      },
      mineralLedgerEntry: {
        create: async ({ data }: { data: { ownerAddress: string; amountMicros: bigint } }) => ledger.push(data),
      },
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

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ ownerAddress: previousOwner, amountMicros: 1_000_000n });
    expect(currentOwner).toBe(nextOwner);
  });
});

describe('PrismaPlanetIndexStore reorg resets', () => {
  it('rewinds deployment-scoped derived state in FK-safe order before resetting the cursor', async () => {
    const calls: string[] = [];
    const miningDeletes: unknown[] = [];
    const transaction = {
      mineralLedgerEntry: { deleteMany: async ({ where }: { where: unknown }) => { miningDeletes.push(['ledger', where]); calls.push('mineralLedgerEntry.deleteMany'); } },
      planetAccrualState: { deleteMany: async ({ where }: { where: unknown }) => { miningDeletes.push(['accrual', where]); calls.push('planetAccrualState.deleteMany'); } },
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
      'mineralLedgerEntry.deleteMany',
      'planetAccrualState.deleteMany',
      'planetOwnershipHistory.deleteMany',
      'processedBlockchainEvent.deleteMany',
      'planet.deleteMany',
      'indexerCursor.updateMany',
    ]);
    expect(miningDeletes).toEqual([
      ['ledger', { planet: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContract, mintBlockNumber: { gte: deploymentBlock } } }],
      ['accrual', { planet: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContract, mintBlockNumber: { gte: deploymentBlock } } }],
    ]);
  });

  it('fails closed instead of deleting mining history for a pre-fork Planet', async () => {
    const transaction = {
      planet: {
        findMany: async () => [{ id: 'old-planet' }],
        deleteMany: async () => { throw new Error('must not delete'); },
      },
      mineralLedgerEntry: { deleteMany: async () => { throw new Error('must not delete'); } },
      planetAccrualState: { deleteMany: async () => { throw new Error('must not delete'); } },
    };
    const prisma = {
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient;

    await expect(new PrismaPlanetIndexStore(prisma).rewind(planetContract, deploymentBlock)).rejects.toThrow(/historical Planet mining state/i);
  });
});

describe('planet indexer cursor hashing', () => {
  const config: Stage2Config = {
    databaseUrl: 'postgresql://not-used-in-tests',
    rpcUrl: 'https://rpc.example.test',
    rpcFallbackUrls: [],
    appOrigin: 'http://127.0.0.1:5173',
    sessionTtlSeconds: 86_400,
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
