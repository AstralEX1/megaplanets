import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicClient, keccak256, stringToHex, type Hex } from 'viem';
import { createPlanetConfig, derivePlanet } from '@megaplanets/planet-generator';
import { BASE_SEPOLIA_CHAIN_ID } from './config';
import { BASE_SEPOLIA_JACKPOT, type MegasteraProof } from './eligibility';
import type { PrismaClient } from './generated/prisma/client';
import { indexPlanetEvents, PrismaPlanetIndexStore, type MintedPlanetEvent, type PlanetTransferEvent } from './planetIndexer';
import type { Stage2Config } from './stage2Config';

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return { ...actual, createPublicClient: vi.fn() };
});

const previousOwner = '0x0000000000000000000000000000000000000001' as const;
const nextOwner = '0x0000000000000000000000000000000000000002' as const;
const planetContract = '0x0000000000000000000000000000000000000003' as const;
const deploymentBlock = 45_347_860n;
const mintTxHash = `0x${'11'.repeat(32)}` as Hex;
const mintBlockHash = `0x${'22'.repeat(32)}` as Hex;
const originTxHash = `0x${'33'.repeat(32)}` as Hex;
const originBlockHash = `0x${'44'.repeat(32)}` as Hex;
const mintRecipient = '0x0000000000000000000000000000000000000005' as const;
const zeroAddress = '0x0000000000000000000000000000000000000000' as const;

function blockHash(blockNumber: bigint): Hex {
  return `0x${blockNumber.toString(16).padStart(64, '0')}`;
}

const proof: MegasteraProof = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  jackpotAddress: BASE_SEPOLIA_JACKPOT,
  source: stringToHex('MEGAPLANETS_V1', { size: 32 }),
  recipient: mintRecipient,
  ticketId: 42n,
  drawingId: 7n,
  normals: [1, 2, 3, 4, 5],
  bonusBall: 6,
  originTxHash,
  blockNumber: deploymentBlock - 1n,
  blockHash: originBlockHash,
  logIndex: 3n,
  purchasedAt: new Date('2026-08-10T00:00:00.000Z'),
};

const canonicalPlanet = derivePlanet({
  ticketId: proof.ticketId,
  drawingId: proof.drawingId,
  normals: proof.normals,
  bonusBall: proof.bonusBall,
  originTxHash: proof.originTxHash,
}, createPlanetConfig());

const mintedEvent: MintedPlanetEvent = {
  chainId: BASE_SEPOLIA_CHAIN_ID,
  contractAddress: planetContract,
  transactionHash: mintTxHash,
  logIndex: 9,
  blockNumber: deploymentBlock,
  blockHash: mintBlockHash,
  blockTimestamp: new Date('2026-08-10T00:00:06.000Z'),
  tokenId: 1n,
  ticketId: 42n,
  recipient: mintRecipient,
  traits: {
    seed: canonicalPlanet.seed,
    traitsHash: canonicalPlanet.traitsHash,
    baseMineralsPerDay: canonicalPlanet.traits.minerals,
    generatorVersion: 2,
    planetType: canonicalPlanet.traits.typeId,
    terrain: canonicalPlanet.traits.terrain,
    rarity: canonicalPlanet.traits.rarity,
    satelliteCount: canonicalPlanet.traits.satelliteCount,
    hasRing: canonicalPlanet.traits.hasRing,
  },
  metadataHash: keccak256(stringToHex('ipfs://metadata/1')),
  metadataUri: 'ipfs://metadata/1',
};

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

describe('PrismaPlanetIndexStore mint provenance projection', () => {
  function makePrisma(seedTicket?: Record<string, unknown>) {
    let ticket = seedTicket ? { ...seedTicket } : undefined;
    let planet: Record<string, unknown> | undefined;
    const processed: Record<string, unknown>[] = [];
    const history: Record<string, unknown>[] = [];
    const transaction = {
      $queryRaw(this: unknown, strings: TemplateStringsArray, ..._values: unknown[]) {
        expect(this).toBe(transaction);
        expect(strings.join('?')).toContain('SELECT 1 AS locked');
        return Promise.resolve();
      },
      ticketPurchase: {
        findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.id) return ticket;
          if (where.chainId_jackpotAddress_ticketId) return ticket;
          if (where.chainId_originTxHash_logIndex) return ticket;
          return undefined;
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          ticket = { id: 'ticket-1', ...data };
          return ticket;
        }),
      },
      planet: {
        findUnique: vi.fn(async () => planet),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          planet = { id: 'planet-1', ...data };
          return planet;
        }),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (planet) planet = { ...planet, ...data };
        }),
      },
      planetOwnershipHistory: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          history.push(data);
        }),
      },
      processedBlockchainEvent: {
        findUnique: vi.fn(async ({ where }: { where: { chainId_contractAddress_transactionHash_logIndex?: { transactionHash: string; logIndex: number } } }) => processed.find((entry) => {
          const identity = where.chainId_contractAddress_transactionHash_logIndex;
          return identity && entry.transactionHash === identity.transactionHash && entry.logIndex === identity.logIndex;
        })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          processed.push(data);
          return data;
        }),
      },
    };
    const prisma = {
      processedBlockchainEvent: { findUnique: transaction.processedBlockchainEvent.findUnique },
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => {
        const beforeTicket = ticket ? { ...ticket } : undefined;
        const beforePlanet = planet ? { ...planet } : undefined;
        const beforeProcessedLength = processed.length;
        const beforeHistoryLength = history.length;
        try {
          return await callback(transaction);
        } catch (error) {
          ticket = beforeTicket;
          planet = beforePlanet;
          processed.length = beforeProcessedLength;
          history.length = beforeHistoryLength;
          throw error;
        }
      },
    } as unknown as PrismaClient;
    return { prisma, transaction, getTicket: () => ticket, getPlanet: () => planet, history, processed };
  }

  it('atomically creates the proof, Planet, and marker, then replays as a no-op', async () => {
    const state = makePrisma();
    const store = new PrismaPlanetIndexStore(state.prisma);

    await expect(store.recordMinted(mintedEvent, proof)).resolves.toBe(true);
    expect(state.getTicket()).toMatchObject({
      chainId: BASE_SEPOLIA_CHAIN_ID,
      jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
      ticketId: proof.ticketId.toString(),
      drawingId: proof.drawingId.toString(),
      recipient: mintRecipient,
      normals: proof.normals,
      bonusBall: proof.bonusBall,
      source: stringToHex('MEGAPLANETS_V1', { size: 32 }),
      originTxHash: originTxHash,
      blockNumber: proof.blockNumber,
      blockHash: originBlockHash,
      logIndex: Number(proof.logIndex),
      purchasedAt: proof.purchasedAt,
    });
    expect(state.getPlanet()).toMatchObject({ ticketPurchaseId: 'ticket-1', ownerAddress: zeroAddress });
    expect(state.processed).toHaveLength(1);

    await expect(store.recordMinted(mintedEvent, proof)).resolves.toBe(false);
    expect(state.transaction.ticketPurchase.create).toHaveBeenCalledTimes(1);
    expect(state.transaction.planet.create).toHaveBeenCalledTimes(1);
    expect(state.processed).toHaveLength(1);
  });

  it('rolls back TicketPurchase and Planet writes when the processed marker fails', async () => {
    const state = makePrisma();
    state.transaction.processedBlockchainEvent.create.mockRejectedValueOnce(new Error('marker write failed'));
    const store = new PrismaPlanetIndexStore(state.prisma);

    await expect(store.recordMinted(mintedEvent, proof)).rejects.toThrow('marker write failed');
    expect(state.getTicket()).toBeUndefined();
    expect(state.getPlanet()).toBeUndefined();
    expect(state.processed).toHaveLength(0);

    await expect(store.recordMinted(mintedEvent, proof)).resolves.toBe(true);
    expect(state.getTicket()).toBeDefined();
    expect(state.getPlanet()).toBeDefined();
    expect(state.processed).toHaveLength(1);
  });

  it('compares every immutable TicketPurchase field before reusing a pre-existing row', async () => {
    const existing = {
      id: 'ticket-existing',
      chainId: BASE_SEPOLIA_CHAIN_ID,
      jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
      ticketId: proof.ticketId.toString(),
      drawingId: proof.drawingId.toString(),
      recipient: mintRecipient,
      normals: [1, 2, 3, 4, 99],
      bonusBall: proof.bonusBall,
      source: stringToHex('MEGAPLANETS_V1', { size: 32 }),
      originTxHash,
      blockNumber: proof.blockNumber,
      blockHash: originBlockHash,
      logIndex: Number(proof.logIndex),
      purchasedAt: proof.purchasedAt,
    };
    const state = makePrisma(existing);
    await expect(new PrismaPlanetIndexStore(state.prisma).recordMinted(mintedEvent, proof))
      .rejects.toThrow('immutable Megastera proof fields');
    expect(state.transaction.ticketPurchase.create).not.toHaveBeenCalled();
    expect(state.transaction.planet.create).not.toHaveBeenCalled();
    expect(state.processed).toHaveLength(0);
  });

  it('rejects a mint event whose ticket or recipient disagrees with its proof', async () => {
    const ticketMismatch = makePrisma();
    await expect(new PrismaPlanetIndexStore(ticketMismatch.prisma).recordMinted(
      { ...mintedEvent, ticketId: proof.ticketId + 1n },
      proof,
    )).rejects.toThrow(/ticket/i);
    expect(ticketMismatch.transaction.ticketPurchase.create).not.toHaveBeenCalled();

    const recipientMismatch = makePrisma();
    await expect(new PrismaPlanetIndexStore(recipientMismatch.prisma).recordMinted(
      { ...mintedEvent, recipient: nextOwner },
      proof,
    )).rejects.toThrow(/recipient/i);
    expect(recipientMismatch.transaction.ticketPurchase.create).not.toHaveBeenCalled();
  });

  it('rejects a processed-event identity replay when its immutable payload changes', async () => {
    const state = makePrisma();
    const store = new PrismaPlanetIndexStore(state.prisma);
    await expect(store.recordMinted(mintedEvent, proof)).resolves.toBe(true);
    const changedEvent = { ...mintedEvent, metadataHash: `0x${'88'.repeat(32)}` as Hex };
    await expect(store.recordMinted(changedEvent, proof)).rejects.toThrow('conflicts with immutable payload');
    expect(state.transaction.ticketPurchase.create).toHaveBeenCalledTimes(1);
    expect(state.transaction.planet.create).toHaveBeenCalledTimes(1);
    expect(state.processed).toHaveLength(1);
  });

  it('rejects a Transfer identity replay when from/to/token payload changes', async () => {
    const state = makePrisma();
    const store = new PrismaPlanetIndexStore(state.prisma);
    await store.recordMinted(mintedEvent, proof);
    const initialTransfer: PlanetTransferEvent = {
      chainId: BASE_SEPOLIA_CHAIN_ID,
      contractAddress: planetContract,
      tokenId: mintedEvent.tokenId,
      from: zeroAddress,
      to: mintRecipient,
      transactionHash: mintTxHash,
      blockNumber: deploymentBlock,
      blockHash: mintBlockHash,
      logIndex: mintedEvent.logIndex + 1,
      blockTimestamp: mintedEvent.blockTimestamp,
    };
    await store.recordTransfer(initialTransfer);
    await expect(store.recordTransfer({ ...initialTransfer, to: nextOwner })).rejects.toThrow('conflicts with immutable payload');
  });

  it('requires the initial zero-address Transfer recipient to match the mint proof', async () => {
    const state = makePrisma();
    const store = new PrismaPlanetIndexStore(state.prisma);
    await store.recordMinted(mintedEvent, proof);
    const transfer = {
      chainId: BASE_SEPOLIA_CHAIN_ID,
      contractAddress: planetContract,
      tokenId: mintedEvent.tokenId,
      from: zeroAddress,
      to: nextOwner,
      transactionHash: mintTxHash,
      blockNumber: deploymentBlock,
      blockHash: mintBlockHash,
      logIndex: mintedEvent.logIndex + 1,
      blockTimestamp: mintedEvent.blockTimestamp,
    } satisfies PlanetTransferEvent;
    await expect(store.recordTransfer(transfer)).rejects.toThrow('initial Transfer recipient');
    await expect(store.recordTransfer({ ...transfer, to: mintRecipient })).resolves.toBe(true);
    expect(state.getPlanet()).toMatchObject({ ownerAddress: mintRecipient });
    expect(state.history).toHaveLength(1);
    await expect(store.recordTransfer({ ...transfer, to: nextOwner })).rejects.toThrow('immutable payload');
    expect(state.history).toHaveLength(1);
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

  it('restores a surviving Planet owner from its latest retained ownership event', async () => {
    const update = vi.fn(async () => undefined);
    const transaction = {
      planetOwnershipHistory: { deleteMany: vi.fn(async () => undefined) },
      processedBlockchainEvent: { deleteMany: vi.fn(async () => undefined) },
      planet: {
        deleteMany: vi.fn(async () => undefined),
        findMany: vi.fn(async () => [{
          id: 'planet-survivor',
          ownershipHistory: [{ toAddress: previousOwner }],
        }]),
        update,
      },
      indexerCursor: { updateMany: vi.fn(async () => undefined) },
    };
    const prisma = {
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient;

    await new PrismaPlanetIndexStore(prisma).rewind(planetContract, deploymentBlock + 10n);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'planet-survivor' },
      data: { ownerAddress: previousOwner },
    });
    expect(transaction.planet.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ mintBlockNumber: { lt: deploymentBlock + 10n } }),
    }));
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

  it('rejects a zero-block reorg window that cannot replay the mismatched boundary', async () => {
    await expect(indexPlanetEvents(config, {
      getCursor: vi.fn(),
      setCursor: vi.fn(),
      rewind: vi.fn(),
      recordMinted: vi.fn(),
      recordTransfer: vi.fn(),
    }, { reorgWindow: 0n })).rejects.toThrow('bounds');
  });

});

describe('planet projector provenance integration', () => {
  const config: Stage2Config = {
    databaseUrl: 'postgresql://not-used-in-tests',
    rpcUrl: 'https://rpc.example.test',
    rpcFallbackUrls: [],
    chainId: BASE_SEPOLIA_CHAIN_ID,
    planetContractAddress: planetContract,
    planetDeploymentBlock: deploymentBlock,
  };

  function makeClient() {
    const mintedLog = {
      address: planetContract,
      blockNumber: deploymentBlock,
      blockHash: mintBlockHash,
      transactionHash: mintTxHash,
      logIndex: mintedEvent.logIndex,
      args: {
        tokenId: mintedEvent.tokenId,
        ticketId: mintedEvent.ticketId,
        recipient: mintedEvent.recipient,
        seed: mintedEvent.traits.seed,
        metadataHash: mintedEvent.metadataHash,
      },
    };
    const transferLog = {
      address: planetContract,
      blockNumber: deploymentBlock,
      blockHash: mintBlockHash,
      transactionHash: mintTxHash,
      logIndex: mintedEvent.logIndex + 1,
      args: { tokenId: mintedEvent.tokenId, from: zeroAddress, to: mintRecipient },
    };
    return {
      getBlockNumber: vi.fn().mockResolvedValue(deploymentBlock + 6n),
      getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
        hash: blockNumber === deploymentBlock ? mintBlockHash : blockHash(blockNumber),
        timestamp: 1_754_784_006n,
      })),
      getLogs: vi.fn(async ({ event }: { event: { name: string } }) => event.name === 'PlanetMinted' ? [mintedLog] : [transferLog]),
      readContract: vi.fn().mockResolvedValue(mintedEvent.metadataUri),
      getTransaction: vi.fn(),
      getTransactionReceipt: vi.fn(),
    };
  }

  it('resolves a mint proof before persistence and applies the initial zero-address Transfer', async () => {
    const client = makeClient();
    vi.mocked(createPublicClient).mockReturnValue(client as never);
    const resolver = {
      clearCache: vi.fn(),
      resolveMint: vi.fn().mockResolvedValue({ proof, voucher: {
        recipient: mintRecipient,
        ticketId: proof.ticketId,
        drawingId: proof.drawingId,
        originTxHash: proof.originTxHash,
        seed: mintedEvent.traits.seed,
        traitsHash: mintedEvent.traits.traitsHash,
        metadataHash: mintedEvent.metadataHash,
        metadataURI: mintedEvent.metadataUri,
        expiresAt: 9_999_999_999n,
      } }),
    };
    const store = {
      getCursor: vi.fn().mockResolvedValue(undefined),
      setCursor: vi.fn().mockResolvedValue(undefined),
      rewind: vi.fn().mockResolvedValue(undefined),
      recordMinted: vi.fn().mockResolvedValue(true),
      recordTransfer: vi.fn().mockResolvedValue(true),
    };

    await indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
      provenanceResolver: resolver,
    });

    expect(resolver.clearCache).toHaveBeenCalledTimes(1);
    expect(resolver.resolveMint).toHaveBeenCalledWith(planetContract, expect.objectContaining({
      chainId: BASE_SEPOLIA_CHAIN_ID,
      ticketId: proof.ticketId,
      recipient: mintRecipient,
    }));
    expect(store.recordMinted).toHaveBeenCalledWith(expect.objectContaining({ tokenId: 1n }), proof);
    expect(store.recordTransfer).toHaveBeenCalledWith(expect.objectContaining({ from: zeroAddress, to: mintRecipient }));
    expect(store.setCursor).toHaveBeenCalledTimes(1);
  });

  it('does not advance the cursor when provenance resolution fails', async () => {
    const client = makeClient();
    vi.mocked(createPublicClient).mockReturnValue(client as never);
    const resolver = {
      clearCache: vi.fn(),
      resolveMint: vi.fn().mockRejectedValue(new Error('origin receipt unavailable')),
    };
    const store = {
      getCursor: vi.fn().mockResolvedValue(undefined),
      setCursor: vi.fn().mockResolvedValue(undefined),
      rewind: vi.fn().mockResolvedValue(undefined),
      recordMinted: vi.fn(),
      recordTransfer: vi.fn(),
    };

    await expect(indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
      provenanceResolver: resolver,
    })).rejects.toThrow('origin receipt unavailable');
    expect(store.setCursor).not.toHaveBeenCalled();
  });

  it('replays committed event rows after a cursor-write failure, then advances on restart', async () => {
    const client = makeClient();
    vi.mocked(createPublicClient).mockReturnValue(client as never);
    const resolver = {
      clearCache: vi.fn(),
      resolveMint: vi.fn().mockResolvedValue({ proof, voucher: {
        recipient: mintRecipient,
        ticketId: proof.ticketId,
        drawingId: proof.drawingId,
        originTxHash: proof.originTxHash,
        seed: mintedEvent.traits.seed,
        traitsHash: mintedEvent.traits.traitsHash,
        metadataHash: mintedEvent.metadataHash,
        metadataURI: mintedEvent.metadataUri,
        expiresAt: 9_999_999_999n,
      } }),
    };
    let cursor: { nextBlock: bigint; lastBlockHash?: Hex } | undefined;
    const store = {
      getCursor: vi.fn(async () => cursor),
      setCursor: vi.fn(async (_address: string, nextBlock: bigint, lastBlockHash: Hex) => {
        if (store.setCursor.mock.calls.length === 1) throw new Error('cursor write unavailable');
        cursor = { nextBlock, lastBlockHash };
      }),
      rewind: vi.fn().mockResolvedValue(undefined),
      recordMinted: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
      recordTransfer: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    };

    await expect(indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
      provenanceResolver: resolver,
    })).rejects.toThrow('cursor write unavailable');
    expect(cursor).toBeUndefined();

    await expect(indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
      provenanceResolver: resolver,
    })).resolves.toMatchObject({ eventsProcessed: 0 });
    expect(store.recordMinted).toHaveBeenCalledTimes(2);
    expect(store.recordTransfer).toHaveBeenCalledTimes(2);
    expect(cursor?.nextBlock).toBe(deploymentBlock + 1n);
  });

  it('rejects resolver voucher/proof values that disagree with the PlanetMinted event', async () => {
    const client = makeClient();
    vi.mocked(createPublicClient).mockReturnValue(client as never);
    const resolver = {
      clearCache: vi.fn(),
      resolveMint: vi.fn().mockResolvedValue({ proof, voucher: {
        recipient: mintRecipient,
        ticketId: proof.ticketId + 1n,
        drawingId: proof.drawingId,
        originTxHash: proof.originTxHash,
        seed: mintedEvent.traits.seed,
        traitsHash: mintedEvent.traits.traitsHash,
        metadataHash: mintedEvent.metadataHash,
        metadataURI: mintedEvent.metadataUri,
        expiresAt: 9_999_999_999n,
      } }),
    };
    const store = {
      getCursor: vi.fn().mockResolvedValue(undefined),
      setCursor: vi.fn().mockResolvedValue(undefined),
      rewind: vi.fn().mockResolvedValue(undefined),
      recordMinted: vi.fn(),
      recordTransfer: vi.fn(),
    };

    await expect(indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
      provenanceResolver: resolver,
    })).rejects.toThrow('voucher ticket');
    expect(store.recordMinted).not.toHaveBeenCalled();
    expect(store.setCursor).not.toHaveBeenCalled();
  });

  it('rejects a resolver voucher whose immutable traits hash disagrees with the derived Planet', async () => {
    const client = makeClient();
    vi.mocked(createPublicClient).mockReturnValue(client as never);
    const resolver = {
      clearCache: vi.fn(),
      resolveMint: vi.fn().mockResolvedValue({ proof, voucher: {
        recipient: mintRecipient,
        ticketId: proof.ticketId,
        drawingId: proof.drawingId,
        originTxHash: proof.originTxHash,
        seed: mintedEvent.traits.seed,
        traitsHash: `0x${'99'.repeat(32)}`,
        metadataHash: mintedEvent.metadataHash,
        metadataURI: mintedEvent.metadataUri,
        expiresAt: 9_999_999_999n,
      } }),
    };
    const store = {
      getCursor: vi.fn().mockResolvedValue(undefined),
      setCursor: vi.fn().mockResolvedValue(undefined),
      rewind: vi.fn().mockResolvedValue(undefined),
      recordMinted: vi.fn(),
      recordTransfer: vi.fn(),
    };

    const run = indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
      provenanceResolver: resolver,
    });
    await expect(run).rejects.toThrow('traits hash');
    expect(client.getLogs).toHaveBeenCalled();
    expect(store.setCursor).not.toHaveBeenCalled();
  });

  it('rejects a resolver voucher whose ticket disagrees with its proof and event', async () => {
    const client = makeClient();
    vi.mocked(createPublicClient).mockReturnValue(client as never);
    const resolver = {
      clearCache: vi.fn(),
      resolveMint: vi.fn().mockResolvedValue({ proof, voucher: {
        recipient: mintRecipient,
        ticketId: proof.ticketId + 1n,
        drawingId: proof.drawingId,
        originTxHash: proof.originTxHash,
        seed: mintedEvent.traits.seed,
        traitsHash: mintedEvent.traits.traitsHash,
        metadataHash: mintedEvent.metadataHash,
        metadataURI: mintedEvent.metadataUri,
        expiresAt: 9_999_999_999n,
      } }),
    };
    const store = {
      getCursor: vi.fn().mockResolvedValue(undefined),
      setCursor: vi.fn(),
      rewind: vi.fn(),
      recordMinted: vi.fn(),
      recordTransfer: vi.fn(),
    };

    await expect(indexPlanetEvents(config, store, {
      confirmations: 6n,
      blockRange: 100n,
      provenanceResolver: resolver,
    })).rejects.toThrow(/voucher ticket/i);
    expect(store.recordMinted).not.toHaveBeenCalled();
    expect(store.setCursor).not.toHaveBeenCalled();
  });
});
