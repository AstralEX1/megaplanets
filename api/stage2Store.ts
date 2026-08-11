import type { Address } from 'viem';
import type { PrismaClient } from './generated/prisma/client';

export type AuthNonceRecord = {
  nonceHash: string;
  walletAddress: Address;
  message: string;
  expiresAt: Date;
};

export type AuthSessionRecord = {
  tokenHash: string;
  walletAddress: Address;
  expiresAt: Date;
};

export type IndexedPlanetRecord = {
  tokenId: string;
  ticketId: string | null;
  ownerAddress: Address;
  kind: 'NORMAL' | 'SPECIAL';
  seed: `0x${string}` | null;
  traitsHash: `0x${string}` | null;
  metadataHash: `0x${string}` | null;
  metadataUri: string;
  baseMineralsPerDay: string | null;
  generatorVersion: number | null;
  planetType: string | null;
  terrain: string | null;
  rarity: string | null;
  satelliteCount: number | null;
  hasRing: boolean | null;
  mintTxHash: `0x${string}`;
  mintedAt: string;
  ticket: {
    drawingId: string;
    normals: number[];
    bonusBall: number;
    originTxHash: `0x${string}`;
  } | null;
};

export type Stage2Store = {
  saveNonce(record: AuthNonceRecord): Promise<void>;
  findNonce(nonceHash: string, walletAddress: Address, now: Date): Promise<AuthNonceRecord | undefined>;
  consumeNonce(nonceHash: string, walletAddress: Address, now: Date): Promise<boolean>;
  createSession(record: AuthSessionRecord): Promise<void>;
  findSession(tokenHash: string, now: Date): Promise<AuthSessionRecord | undefined>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
  listPlanets(ownerAddress: Address): Promise<IndexedPlanetRecord[]>;
  getPlanet(tokenId: string): Promise<IndexedPlanetRecord | undefined>;
};

function serializePlanet(planet: {
  tokenId: { toFixed: (digits?: number) => string };
  ticketId: { toFixed: (digits?: number) => string } | null;
  ownerAddress: string;
  kind: 'NORMAL' | 'SPECIAL';
  seed: string | null;
  traitsHash: string | null;
  metadataHash: string | null;
  metadataUri: string;
  baseMineralsPerDay: bigint | null;
  generatorVersion: number | null;
  planetType: string | null;
  terrain: string | null;
  rarity: string | null;
  satelliteCount: number | null;
  hasRing: boolean | null;
  mintTxHash: string;
  mintedAt: Date;
  ticketPurchase?: {
    drawingId: { toFixed: (digits?: number) => string };
    normals: number[];
    bonusBall: number;
    originTxHash: string;
  } | null;
}): IndexedPlanetRecord {
  return {
    tokenId: planet.tokenId.toFixed(0),
    ticketId: planet.ticketId?.toFixed(0) ?? null,
    ownerAddress: planet.ownerAddress as Address,
    kind: planet.kind,
    seed: planet.seed as `0x${string}` | null,
    traitsHash: planet.traitsHash as `0x${string}` | null,
    metadataHash: planet.metadataHash as `0x${string}` | null,
    metadataUri: planet.metadataUri,
    baseMineralsPerDay: planet.baseMineralsPerDay?.toString() ?? null,
    generatorVersion: planet.generatorVersion,
    planetType: planet.planetType,
    terrain: planet.terrain,
    rarity: planet.rarity,
    satelliteCount: planet.satelliteCount,
    hasRing: planet.hasRing,
    mintTxHash: planet.mintTxHash as `0x${string}`,
    mintedAt: planet.mintedAt.toISOString(),
    ticket: planet.ticketPurchase
      ? {
          drawingId: planet.ticketPurchase.drawingId.toFixed(0),
          normals: planet.ticketPurchase.normals,
          bonusBall: planet.ticketPurchase.bonusBall,
          originTxHash: planet.ticketPurchase.originTxHash as `0x${string}`,
        }
      : null,
  };
}

export class PrismaStage2Store implements Stage2Store {
  public constructor(private readonly prisma: PrismaClient) {}

  async saveNonce(record: AuthNonceRecord): Promise<void> {
    await this.prisma.authNonce.create({ data: record });
  }

  async findNonce(nonceHash: string, walletAddress: Address, now: Date) {
    const record = await this.prisma.authNonce.findFirst({
      where: { nonceHash, walletAddress, consumedAt: null, expiresAt: { gt: now } },
    });
    return record
      ? { nonceHash: record.nonceHash, walletAddress: record.walletAddress as Address, message: record.message, expiresAt: record.expiresAt }
      : undefined;
  }

  async consumeNonce(nonceHash: string, walletAddress: Address, now: Date): Promise<boolean> {
    const result = await this.prisma.authNonce.updateMany({
      where: { nonceHash, walletAddress, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    return result.count === 1;
  }

  async createSession(record: AuthSessionRecord): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.upsert({
        where: { walletAddress: record.walletAddress },
        update: {},
        create: { walletAddress: record.walletAddress },
      });
      await transaction.walletSession.create({
        data: { userId: user.id, tokenHash: record.tokenHash, expiresAt: record.expiresAt },
      });
    });
  }

  async findSession(tokenHash: string, now: Date) {
    const session = await this.prisma.walletSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
      include: { user: true },
    });
    return session
      ? { tokenHash: session.tokenHash, walletAddress: session.user.walletAddress as Address, expiresAt: session.expiresAt }
      : undefined;
  }

  async revokeSession(tokenHash: string, now: Date): Promise<void> {
    await this.prisma.walletSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async listPlanets(ownerAddress: Address): Promise<IndexedPlanetRecord[]> {
    const planets = await this.prisma.planet.findMany({
      where: { ownerAddress },
      orderBy: [{ mintedAt: 'desc' }, { tokenId: 'asc' }],
      include: { ticketPurchase: true },
    });
    return planets.map(serializePlanet);
  }

  async getPlanet(tokenId: string): Promise<IndexedPlanetRecord | undefined> {
    const planet = await this.prisma.planet.findFirst({ where: { tokenId }, include: { ticketPurchase: true } });
    return planet ? serializePlanet(planet) : undefined;
  }
}

export class MemoryStage2Store implements Stage2Store {
  private readonly nonces = new Map<string, AuthNonceRecord & { consumedAt?: Date }>();
  private readonly sessions = new Map<string, AuthSessionRecord & { revokedAt?: Date }>();
  private readonly planets = new Map<string, IndexedPlanetRecord>();

  async saveNonce(record: AuthNonceRecord) {
    if (this.nonces.has(record.nonceHash)) throw new Error('Duplicate nonce.');
    this.nonces.set(record.nonceHash, record);
  }

  async findNonce(nonceHash: string, walletAddress: Address, now: Date) {
    const record = this.nonces.get(nonceHash);
    return record && !record.consumedAt && record.walletAddress === walletAddress && record.expiresAt > now
      ? record
      : undefined;
  }

  async consumeNonce(nonceHash: string, walletAddress: Address, now: Date) {
    const record = await this.findNonce(nonceHash, walletAddress, now);
    if (!record) return false;
    this.nonces.set(nonceHash, { ...record, consumedAt: now });
    return true;
  }

  async createSession(record: AuthSessionRecord) {
    this.sessions.set(record.tokenHash, record);
  }

  async findSession(tokenHash: string, now: Date) {
    const record = this.sessions.get(tokenHash);
    return record && !record.revokedAt && record.expiresAt > now ? record : undefined;
  }

  async revokeSession(tokenHash: string, now: Date) {
    const record = this.sessions.get(tokenHash);
    if (record) this.sessions.set(tokenHash, { ...record, revokedAt: now });
  }

  async listPlanets(ownerAddress: Address) {
    return [...this.planets.values()].filter((planet) => planet.ownerAddress === ownerAddress);
  }

  async getPlanet(tokenId: string) {
    return this.planets.get(tokenId);
  }

  seedPlanet(planet: IndexedPlanetRecord) {
    this.planets.set(planet.tokenId, planet);
  }
}
