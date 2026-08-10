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
  public constructor(private readonly prisma: PrismaClient) {}

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
        ticketPurchase: { ticketId: ticketId.toString() },
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

  async getCursor(): Promise<bigint | undefined> {
    const cursor = await this.prisma.indexerCursor.findUnique({
      where: {
        chainId_contractAddress_stream: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
          stream: 'megapot-tickets',
        },
      },
    });
    return cursor ? cursor.nextBlock - 1n : undefined;
  }

  async setCursor(blockNumber: bigint): Promise<void> {
    await this.prisma.indexerCursor.upsert({
      where: {
        chainId_contractAddress_stream: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
          stream: 'megapot-tickets',
        },
      },
      update: { nextBlock: blockNumber + 1n },
      create: {
        chainId: BASE_SEPOLIA_CHAIN_ID,
        contractAddress: BASE_SEPOLIA_JACKPOT.toLowerCase(),
        stream: 'megapot-tickets',
        nextBlock: blockNumber + 1n,
      },
    });
  }

  async getSnapshot(seasonId: Hex, blockNumber: bigint): Promise<DailySnapshot | undefined> {
    const record = await this.prisma.dailySnapshotRecord.findUnique({
      where: { seasonId_blockNumber: { seasonId: seasonId.toLowerCase(), blockNumber } },
    });
    return record ? deserializeDailySnapshot(record.snapshot as PersistedSnapshot) : undefined;
  }

  async saveSnapshot(snapshot: DailySnapshot): Promise<void> {
    await this.prisma.dailySnapshotRecord.create({
      data: {
        seasonId: snapshot.seasonId.toLowerCase(),
        blockNumber: snapshot.blockNumber,
        snapshot: jsonValue(serializeDailySnapshot(snapshot)),
        capturedAt: new Date(snapshot.capturedAt),
      },
    });
  }
}
