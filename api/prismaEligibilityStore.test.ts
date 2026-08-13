import { describe, expect, it, vi } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_LAUNCH_BLOCK, MEGAPLANETS_SOURCE } from './config';
import { BASE_SEPOLIA_JACKPOT } from './eligibility';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaEligibilityStore, TICKET_INDEX_STREAM } from './prismaEligibilityStore';
import type { PlanetArtifact } from './store';

const planetContract = '0x0000000000000000000000000000000000000003' as const;
const proofRecord = {
  recipient: '0x1111111111111111111111111111111111111111',
  ticketId: { toFixed: () => '456' },
  drawingId: { toFixed: () => '123' },
  normals: [2, 7, 14, 22, 29],
  bonusBall: 9,
  originTxHash: `0x${'ab'.repeat(32)}`,
  blockNumber: 44_997_183n,
  blockHash: `0x${'cd'.repeat(32)}`,
  logIndex: 4,
  purchasedAt: new Date('2026-08-11T00:00:00.000Z'),
  chainId: BASE_SEPOLIA_CHAIN_ID,
  jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
  source: `0x${Buffer.from(MEGAPLANETS_SOURCE).toString('hex').padEnd(64, '0')}`,
};

describe('PrismaEligibilityStore reorg resets', () => {
  it('rewinds ticket provenance in FK-safe order without touching legacy snapshots', async () => {
    const calls: string[] = [];
    const transaction = {
      planetOwnershipHistory: { deleteMany: vi.fn(async () => { calls.push('planetOwnershipHistory.deleteMany'); }) },
      processedBlockchainEvent: { deleteMany: vi.fn(async () => { calls.push('processedBlockchainEvent.deleteMany'); }) },
      planet: {
        findMany: async () => [],
        deleteMany: vi.fn(async () => { calls.push('planet.deleteMany'); }),
      },
      planetArtifact: { deleteMany: vi.fn(async () => { calls.push('planetArtifact.deleteMany'); }) },
      mintVoucherRecord: { deleteMany: vi.fn(async () => { calls.push('mintVoucherRecord.deleteMany'); }) },
      ticketPurchase: { deleteMany: vi.fn(async () => { calls.push('ticketPurchase.deleteMany'); }) },
      indexerCursor: { updateMany: vi.fn(async () => { calls.push('indexerCursor.updateMany'); }) },
    };
    const prisma = {
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient;

    const store = new PrismaEligibilityStore(prisma, planetContract);
    const rewind = (store as { rewind?: (fromBlock: bigint) => Promise<void> }).rewind;

    expect(rewind).toBeTypeOf('function');
    if (!rewind) return;

    await rewind.call(store, MEGAPLANETS_LAUNCH_BLOCK);

    expect(calls).toEqual([
      'planetOwnershipHistory.deleteMany',
      'processedBlockchainEvent.deleteMany',
      'planet.deleteMany',
      'planetArtifact.deleteMany',
      'mintVoucherRecord.deleteMany',
      'ticketPurchase.deleteMany',
      'indexerCursor.updateMany',
    ]);
    expect(transaction.indexerCursor.updateMany).toHaveBeenCalledWith({
      where: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        OR: [
          {
            contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
            stream: TICKET_INDEX_STREAM,
          },
          {
            contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
            stream: 'megapot-tickets',
          },
          {
            contractAddress: planetContract.toLowerCase(),
            stream: 'megaplanets-v2',
          },
        ],
      },
      data: { nextBlock: MEGAPLANETS_LAUNCH_BLOCK, lastBlockHash: null },
    });
    expect(transaction.planet.deleteMany).toHaveBeenCalledWith({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContract.toLowerCase(), mintBlockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } } });
    expect(transaction.processedBlockchainEvent.deleteMany).toHaveBeenCalledWith({ where: { chainId: 84532, contractAddress: planetContract.toLowerCase(), blockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } } });
    expect(transaction.ticketPurchase.deleteMany).toHaveBeenCalledWith({
      where: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } },
    });
    expect(transaction.mintVoucherRecord.deleteMany).toHaveBeenCalledWith({
      where: { ticketPurchase: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: MEGAPLANETS_LAUNCH_BLOCK } } },
    });
  });
});

describe('PrismaEligibilityStore activation cursor', () => {
  it('writes the same v2 activation stream that reads use', async () => {
    const upsert = vi.fn(async () => undefined);
    const store = new PrismaEligibilityStore({
      indexerCursor: { upsert },
    } as unknown as PrismaClient);

    await store.setCursor(45_000_000n, `0x${'ef'.repeat(32)}`);

    expect(upsert).toHaveBeenCalledWith({
      where: {
        chainId_contractAddress_stream: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
          stream: TICKET_INDEX_STREAM,
        },
      },
      update: { nextBlock: 45_000_000n, lastBlockHash: `0x${'ef'.repeat(32)}` },
      create: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        stream: TICKET_INDEX_STREAM,
        nextBlock: 45_000_000n,
        lastBlockHash: `0x${'ef'.repeat(32)}`,
      },
    });
  });
});

describe('PrismaEligibilityStore Megastera proof lookup', () => {
  it('lists canonical proofs for one recipient with bounded newest-first pagination', async () => {
    const count = vi.fn(async () => 2);
    const findMany = vi.fn(async () => [proofRecord]);
    const prisma = {
      ticketPurchase: { count, findMany },
    } as unknown as PrismaClient;
    const store = new PrismaEligibilityStore(prisma);

    const result = await store.listProofs('0x1111111111111111111111111111111111111111', { offset: 1, limit: 1 });

    expect(result).toMatchObject({ total: 2, offset: 1, limit: 1, proofs: [expect.objectContaining({ ticketId: 456n })] });
    expect(count).toHaveBeenCalledWith({
      where: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        source: proofRecord.source,
        recipient: proofRecord.recipient,
      },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        source: proofRecord.source,
        recipient: proofRecord.recipient,
      },
      orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
      skip: 1,
      take: 1,
    });
  });
});

describe('PrismaEligibilityStore immutable Planet artifacts', () => {
  const artifact: PlanetArtifact = {
    key: `${proofRecord.originTxHash}:4`,
    ticketId: '456',
    recipient: proofRecord.recipient as `0x${string}`,
    seed: `0x${'11'.repeat(32)}`,
    traitsHash: `0x${'22'.repeat(32)}`,
    metadataHash: `0x${'33'.repeat(32)}`,
    metadataURI: 'ipfs://metadata-cid',
    mediaURI: 'ipfs://media-cid',
    mediaHash: `0x${'44'.repeat(32)}`,
  };

  it('reads a persisted artifact by its immutable receipt key', async () => {
    const findUnique = vi.fn(async () => ({
      artifactKey: artifact.key,
      ticketId: { toFixed: () => artifact.ticketId },
      recipient: artifact.recipient,
      seed: artifact.seed,
      traitsHash: artifact.traitsHash,
      metadataHash: artifact.metadataHash,
      metadataUri: artifact.metadataURI,
      mediaUri: artifact.mediaURI,
      mediaHash: artifact.mediaHash,
    }));
    const store = new PrismaEligibilityStore({ planetArtifact: { findUnique } } as unknown as PrismaClient);

    await expect(store.getArtifact(artifact.key)).resolves.toEqual(artifact);
    expect(findUnique).toHaveBeenCalledWith({ where: { artifactKey: artifact.key } });
  });

  it('creates an artifact once and rejects immutable content conflicts', async () => {
    const existing = vi.fn(async (): Promise<unknown> => undefined);
    const create = vi.fn(async () => undefined);
    const ticketFind = vi.fn(async () => ({ id: 'ticket-row', ticketId: { toFixed: () => artifact.ticketId }, recipient: proofRecord.recipient }));
    const transaction = {
      planetArtifact: { findUnique: existing, create },
      ticketPurchase: { findUnique: ticketFind },
    };
    const store = new PrismaEligibilityStore({
      $transaction: async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    } as unknown as PrismaClient);

    await store.saveArtifact(artifact);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        artifactKey: artifact.key,
        ticketPurchaseId: 'ticket-row',
        ticketId: artifact.ticketId,
        recipient: artifact.recipient,
        metadataUri: artifact.metadataURI,
        mediaUri: artifact.mediaURI,
      }),
    });

    existing.mockResolvedValue({
      artifactKey: artifact.key,
      ticketId: { toFixed: () => artifact.ticketId },
      recipient: artifact.recipient,
      seed: artifact.seed,
      traitsHash: artifact.traitsHash,
      metadataHash: artifact.metadataHash,
      metadataUri: artifact.metadataURI,
      mediaUri: artifact.mediaURI,
      mediaHash: `0x${'55'.repeat(32)}`,
    });
    await expect(store.saveArtifact(artifact)).rejects.toThrow(/immutable|conflict/i);
  });
});
