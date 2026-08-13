import { getAddress, isHash, stringToHex, type Address, type Hex } from 'viem';
import type { PrismaClient } from './generated/prisma/client';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_SOURCE } from './config';
import { BASE_SEPOLIA_JACKPOT, normalizeMegasteraProof, type MegasteraProof, type MegasteraProofReference } from './eligibility';
import type { DailySnapshot } from './scoring';
import {
  deserializeDailySnapshot,
  deserializePreparedVoucher,
  type EligibilityStore,
  type IndexedTicket,
  type PersistedSnapshot,
  type PersistedVoucher,
  type PlanetArtifact,
  type PreparedVoucher,
  serializeDailySnapshot,
  serializePreparedVoucher,
} from './store';

/** Versioned cursor stream so a previously launch-block-only cursor is replayed from activation. */
export const TICKET_INDEX_STREAM = 'megapot-tickets-v2-activation';
const LEGACY_TICKET_INDEX_STREAM = 'megapot-tickets';

function jsonValue(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
}

function serializeArtifact(record: {
  artifactKey: string;
  ticketId: { toFixed: (digits?: number) => string };
  recipient: string;
  seed: string;
  traitsHash: string;
  metadataHash: string;
  metadataUri: string;
  mediaUri: string;
  mediaHash: string;
}): PlanetArtifact {
  return {
    key: record.artifactKey,
    ticketId: record.ticketId.toFixed(0),
    recipient: getAddress(record.recipient),
    seed: record.seed as Hex,
    traitsHash: record.traitsHash as Hex,
    metadataHash: record.metadataHash as Hex,
    metadataURI: record.metadataUri,
    mediaURI: record.mediaUri,
    mediaHash: record.mediaHash as Hex,
  };
}

function sameArtifact(left: PlanetArtifact, right: PlanetArtifact): boolean {
  return left.key === right.key
    && left.ticketId === right.ticketId
    && left.recipient.toLowerCase() === right.recipient.toLowerCase()
    && left.seed.toLowerCase() === right.seed.toLowerCase()
    && left.traitsHash.toLowerCase() === right.traitsHash.toLowerCase()
    && left.metadataHash.toLowerCase() === right.metadataHash.toLowerCase()
    && left.metadataURI === right.metadataURI
    && left.mediaURI === right.mediaURI
    && left.mediaHash.toLowerCase() === right.mediaHash.toLowerCase();
}

function parseArtifactKey(key: string): { originTxHash: Hex; logIndex: number } {
  const separator = key.lastIndexOf(':');
  const originTxHash = key.slice(0, separator);
  const logIndex = Number(key.slice(separator + 1));
  if (separator <= 0 || !isHash(originTxHash) || !Number.isSafeInteger(logIndex) || logIndex < 0) {
    throw new Error('Planet artifact key is invalid.');
  }
  return { originTxHash: originTxHash as Hex, logIndex };
}

/** PostgreSQL-backed eligibility, voucher, cursor, and legacy snapshot boundary. */
export class PrismaEligibilityStore implements EligibilityStore {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly planetContractAddress?: Address,
  ) {}

  async saveTicket(ticket: IndexedTicket): Promise<void> {
    if (!ticket.blockHash || !ticket.purchasedAt) {
      throw new Error('PostgreSQL ticket persistence requires finalized block provenance.');
    }
    const recipient = getAddress(ticket.recipient).toLowerCase();
    await this.prisma.ticketPurchase.upsert({
      where: {
        chainId_jackpotAddress_ticketId: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
          ticketId: ticket.ticketId.toString(),
        },
      },
      update: {},
      create: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        ticketId: ticket.ticketId.toString(),
        drawingId: ticket.drawingId.toString(),
        recipient,
        normals: [...ticket.normals],
        bonusBall: ticket.bonusBall,
        source: stringToHex(MEGAPLANETS_SOURCE, { size: 32 }),
        originTxHash: ticket.originTxHash.toLowerCase(),
        blockNumber: ticket.blockNumber,
        blockHash: ticket.blockHash.toLowerCase(),
        logIndex: Number(ticket.logIndex),
        purchasedAt: ticket.purchasedAt,
      },
    });
  }

  /** Persists a receipt-verified proof in the existing TicketPurchase table. */
  async saveProof(proof: MegasteraProof): Promise<void> {
    const normalized = normalizeMegasteraProof(proof);
    const existing = await this.getProof({ transactionHash: normalized.originTxHash, logIndex: normalized.logIndex });
    if (existing) {
      if (
        existing.ticketId !== normalized.ticketId ||
        existing.recipient.toLowerCase() !== normalized.recipient.toLowerCase() ||
        existing.drawingId !== normalized.drawingId
      ) {
        throw new Error(`Megastera proof ${normalized.originTxHash}:${normalized.logIndex} conflicts with existing provenance.`);
      }
      return;
    }
    await this.saveTicket(normalized);
  }

  async getProof(reference: MegasteraProofReference | Hex, logIndexOverride?: bigint | number): Promise<MegasteraProof | undefined> {
    const normalizedReference = typeof reference === 'string'
      ? { transactionHash: reference, logIndex: logIndexOverride }
      : reference;
    const transactionHash = normalizedReference.transactionHash ?? normalizedReference.originTxHash;
    if (!transactionHash || normalizedReference.logIndex === undefined) throw new Error('Megastera proof reference is incomplete.');
    const logIndex = typeof normalizedReference.logIndex === 'bigint' ? Number(normalizedReference.logIndex) : normalizedReference.logIndex;
    if (!Number.isSafeInteger(logIndex) || logIndex < 0) throw new Error('Megastera proof log index is invalid.');
    const record = await this.prisma.ticketPurchase.findUnique({
      where: {
        chainId_originTxHash_logIndex: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          originTxHash: transactionHash.toLowerCase(),
          logIndex,
        },
      },
    });
    if (!record) return undefined;
    return normalizeMegasteraProof({
      recipient: getAddress(record.recipient),
      ticketId: BigInt(record.ticketId.toFixed(0)),
      drawingId: BigInt(record.drawingId.toFixed(0)),
      normals: record.normals,
      bonusBall: record.bonusBall,
      originTxHash: record.originTxHash as Hex,
      blockNumber: record.blockNumber,
      logIndex: BigInt(record.logIndex),
      blockHash: record.blockHash as Hex,
      purchasedAt: record.purchasedAt,
      chainId: record.chainId,
      jackpotAddress: getAddress(record.jackpotAddress),
      source: record.source as Hex,
    });
  }

  async listProofs(recipient: Address, pagination: { offset: number; limit: number }) {
    const normalizedRecipient = getAddress(recipient).toLowerCase();
    const where = {
      chainId: BASE_SEPOLIA_CHAIN_ID,
      jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
      source: stringToHex(MEGAPLANETS_SOURCE, { size: 32 }),
      recipient: normalizedRecipient,
    } as const;
    const [total, records] = await Promise.all([
      this.prisma.ticketPurchase.count({ where }),
      this.prisma.ticketPurchase.findMany({
        where,
        orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
        skip: pagination.offset,
        take: pagination.limit,
      }),
    ]);
    const proofs = records.map((record) => normalizeMegasteraProof({
      recipient: getAddress(record.recipient),
      ticketId: BigInt(record.ticketId.toFixed(0)),
      drawingId: BigInt(record.drawingId.toFixed(0)),
      normals: record.normals,
      bonusBall: record.bonusBall,
      originTxHash: record.originTxHash as Hex,
      blockNumber: record.blockNumber,
      logIndex: BigInt(record.logIndex),
      blockHash: record.blockHash as Hex,
      purchasedAt: record.purchasedAt,
      chainId: record.chainId,
      jackpotAddress: getAddress(record.jackpotAddress),
      source: record.source as Hex,
    }));
    return { total, offset: pagination.offset, limit: pagination.limit, proofs };
  }

  async getArtifact(key: string): Promise<PlanetArtifact | undefined> {
    const record = await this.prisma.planetArtifact.findUnique({ where: { artifactKey: key } });
    return record ? serializeArtifact(record) : undefined;
  }

  async saveArtifact(artifact: PlanetArtifact): Promise<void> {
    const { originTxHash, logIndex } = parseArtifactKey(artifact.key);
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.planetArtifact.findUnique({ where: { artifactKey: artifact.key } });
      if (existing) {
        const persisted = serializeArtifact(existing);
        if (!sameArtifact(persisted, artifact)) throw new Error(`Planet artifact ${artifact.key} conflicts with immutable content.`);
        return;
      }
      const ticket = await transaction.ticketPurchase.findUnique({
        where: {
          chainId_originTxHash_logIndex: {
            chainId: BASE_SEPOLIA_CHAIN_ID,
            originTxHash: originTxHash.toLowerCase(),
            logIndex,
          },
        },
      });
      if (!ticket) throw new Error('Planet artifact ticket proof is not persisted.');
      if (ticket.ticketId.toFixed(0) !== artifact.ticketId || ticket.recipient !== getAddress(artifact.recipient).toLowerCase()) {
        throw new Error('Planet artifact does not match the persisted ticket proof.');
      }
      await transaction.planetArtifact.create({
        data: {
          ticketPurchaseId: ticket.id,
          artifactKey: artifact.key,
          ticketId: artifact.ticketId,
          recipient: getAddress(artifact.recipient).toLowerCase(),
          seed: artifact.seed.toLowerCase(),
          traitsHash: artifact.traitsHash.toLowerCase(),
          metadataHash: artifact.metadataHash.toLowerCase(),
          metadataUri: artifact.metadataURI,
          mediaUri: artifact.mediaURI,
          mediaHash: artifact.mediaHash.toLowerCase(),
        },
      });
    });
  }

  async getVoucher(ticketId: bigint, recipient: Address, now: bigint) {
    const record = await this.prisma.mintVoucherRecord.findFirst({
      where: {
        recipient: getAddress(recipient).toLowerCase(),
        expiresAt: { gt: new Date(Number(now) * 1_000) },
        ticketPurchase: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
          ticketId: ticketId.toString(),
        },
      },
    });
    return record ? deserializePreparedVoucher(record.voucher as PersistedVoucher) : undefined;
  }

  async saveVoucher(prepared: PreparedVoucher): Promise<void> {
    const serialized = serializePreparedVoucher(prepared);
    await this.prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticketPurchase.findUnique({
        where: {
          chainId_jackpotAddress_ticketId: {
            chainId: BASE_SEPOLIA_CHAIN_ID,
            jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
            ticketId: prepared.voucher.ticketId.toString(),
          },
        },
      });
      if (!ticket) throw new Error('Voucher ticket is not indexed.');
      if (ticket.recipient !== getAddress(prepared.voucher.recipient).toLowerCase()) {
        throw new Error('Voucher recipient does not match the indexed ticket.');
      }
      await transaction.mintVoucherRecord.upsert({
        where: { ticketPurchaseId: ticket.id },
        update: {
          voucher: jsonValue(serialized),
          signature: prepared.signature,
          signer: getAddress(prepared.signer).toLowerCase(),
          digest: prepared.digest,
          expiresAt: new Date(Number(prepared.voucher.expiresAt) * 1_000),
        },
        create: {
          ticketPurchaseId: ticket.id,
          recipient: getAddress(prepared.voucher.recipient).toLowerCase(),
          voucher: jsonValue(serialized),
          signature: prepared.signature,
          signer: getAddress(prepared.signer).toLowerCase(),
          digest: prepared.digest,
          expiresAt: new Date(Number(prepared.voucher.expiresAt) * 1_000),
        },
      });
    });
  }

  async getCursor() {
    const cursor = await this.prisma.indexerCursor.findUnique({
      where: {
        chainId_contractAddress_stream: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
          stream: TICKET_INDEX_STREAM,
        },
      },
    });
    return cursor
      ? { nextBlock: cursor.nextBlock, lastBlockHash: cursor.lastBlockHash as Hex | undefined }
      : undefined;
  }

  async setCursor(nextBlock: bigint, lastBlockHash: Hex): Promise<void> {
    await this.prisma.indexerCursor.upsert({
      where: {
        chainId_contractAddress_stream: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
          stream: TICKET_INDEX_STREAM,
        },
      },
      update: { nextBlock, lastBlockHash },
      create: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        stream: TICKET_INDEX_STREAM,
        nextBlock,
        lastBlockHash,
      },
    });
  }

  async rewind(fromBlock: bigint): Promise<void> {
    if (!this.planetContractAddress) throw new Error('Planet contract address is required to reset ticket provenance.');
    const planetContractAddress = getAddress(this.planetContractAddress).toLowerCase();
    await this.prisma.$transaction(async (transaction) => {
      // Daily snapshots are legacy, deployment-agnostic records. Leave them
      // untouched here; the snapshot job owns their canonicality policy.
      await transaction.planetOwnershipHistory.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContractAddress, blockNumber: { gte: fromBlock } } });
      await transaction.processedBlockchainEvent.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContractAddress, blockNumber: { gte: fromBlock } } });
      await transaction.planet.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContractAddress, mintBlockNumber: { gte: fromBlock } } });
      await transaction.planetArtifact.deleteMany({ where: { ticketPurchase: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: fromBlock } } } });
      await transaction.mintVoucherRecord.deleteMany({ where: { ticketPurchase: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: fromBlock } } } });
      await transaction.ticketPurchase.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: fromBlock } } });
      await transaction.indexerCursor.updateMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          OR: [
            { contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), stream: TICKET_INDEX_STREAM },
            { contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), stream: LEGACY_TICKET_INDEX_STREAM },
            { contractAddress: planetContractAddress, stream: 'megaplanets-v2' },
          ],
        },
        data: { nextBlock: fromBlock, lastBlockHash: null },
      });
    });
  }

  async getSnapshot(blockNumber: bigint): Promise<DailySnapshot | undefined> {
    const record = await this.prisma.dailySnapshotRecord.findUnique({
      where: { blockNumber },
    });
    return record ? deserializeDailySnapshot(record.snapshot as PersistedSnapshot) : undefined;
  }

  async saveSnapshot(snapshot: DailySnapshot): Promise<void> {
    await this.prisma.dailySnapshotRecord.create({
      data: {
        blockNumber: snapshot.blockNumber,
        snapshot: jsonValue(serializeDailySnapshot(snapshot)),
        capturedAt: new Date(snapshot.capturedAt),
      },
    });
  }
}
