import { getAddress, stringToHex, type Address, type Hex } from 'viem';
import type { PrismaClient } from './generated/prisma/client';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_SOURCE } from './config';
import { BASE_SEPOLIA_JACKPOT } from './eligibility';
import type { DailySnapshot } from './scoring';
import {
  deserializeDailySnapshot,
  deserializePreparedVoucher,
  type EligibilityStore,
  type IndexedTicket,
  type PersistedSnapshot,
  type PersistedVoucher,
  type PreparedVoucher,
  serializeDailySnapshot,
  serializePreparedVoucher,
} from './store';

function jsonValue(value: unknown): object {
  return JSON.parse(JSON.stringify(value)) as object;
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
          stream: 'megapot-tickets',
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
          stream: 'megapot-tickets',
        },
      },
      update: { nextBlock, lastBlockHash },
      create: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        stream: 'megapot-tickets',
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
      const historicalMiningPlanets = await transaction.planet.findMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: planetContractAddress,
          mintBlockNumber: { lt: fromBlock },
          ownershipHistory: { some: { blockNumber: { gte: fromBlock } } },
        },
        select: { id: true },
      });
      if (historicalMiningPlanets.length > 0) {
        throw new Error('Reorg intersects historical Planet mining state; a full derived-state rebuild is required.');
      }
      const scopedPlanet = {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress: planetContractAddress,
        mintBlockNumber: { gte: fromBlock },
      };
      await transaction.mineralLedgerEntry.deleteMany({ where: { planet: scopedPlanet } });
      await transaction.planetAccrualState.deleteMany({ where: { planet: scopedPlanet } });
      await transaction.planetOwnershipHistory.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContractAddress, blockNumber: { gte: fromBlock } } });
      await transaction.processedBlockchainEvent.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContractAddress, blockNumber: { gte: fromBlock } } });
      await transaction.planet.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, contractAddress: planetContractAddress, mintBlockNumber: { gte: fromBlock } } });
      await transaction.mintVoucherRecord.deleteMany({ where: { ticketPurchase: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: fromBlock } } } });
      await transaction.ticketPurchase.deleteMany({ where: { chainId: BASE_SEPOLIA_CHAIN_ID, jackpotAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), blockNumber: { gte: fromBlock } } });
      await transaction.indexerCursor.updateMany({
        where: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          OR: [
            { contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(), stream: 'megapot-tickets' },
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
