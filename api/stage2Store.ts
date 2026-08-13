import type { Address } from 'viem';
import type { PrismaClient } from './generated/prisma/client';

export type PlanetScope = { chainId: number; contractAddress: Address };

export type IndexedPlanetRecord = {
  chainId?: number;
  contractAddress?: Address;
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

function planetKey(planet: IndexedPlanetRecord): string {
  return `${planet.chainId ?? 'unknown'}:${planet.contractAddress?.toLowerCase() ?? 'unknown'}:${planet.tokenId}`;
}

export type Stage2Store = {
  listPlanets(ownerAddress: Address, scope: PlanetScope): Promise<IndexedPlanetRecord[]>;
  getPlanet(tokenId: string, scope: PlanetScope): Promise<IndexedPlanetRecord | undefined>;
};

function serializePlanet(planet: {
  chainId: number;
  contractAddress: string;
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
    chainId: planet.chainId,
    contractAddress: planet.contractAddress as Address,
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

  async listPlanets(ownerAddress: Address, scope: PlanetScope): Promise<IndexedPlanetRecord[]> {
    const planets = await this.prisma.planet.findMany({
      where: { ownerAddress, chainId: scope.chainId, contractAddress: scope.contractAddress.toLowerCase() },
      orderBy: [{ mintedAt: 'desc' }, { tokenId: 'asc' }],
      include: { ticketPurchase: true },
    });
    return planets.map(serializePlanet);
  }

  async getPlanet(tokenId: string, scope: PlanetScope): Promise<IndexedPlanetRecord | undefined> {
    const planet = await this.prisma.planet.findFirst({
      where: { tokenId, chainId: scope.chainId, contractAddress: scope.contractAddress.toLowerCase() },
      include: { ticketPurchase: true },
    });
    return planet ? serializePlanet(planet) : undefined;
  }
}

export class MemoryStage2Store implements Stage2Store {
  private readonly planets = new Map<string, IndexedPlanetRecord>();

  async listPlanets(ownerAddress: Address, scope: PlanetScope) {
    return [...this.planets.values()].filter((planet) =>
      planet.ownerAddress === ownerAddress &&
      planet.chainId === scope.chainId && planet.contractAddress?.toLowerCase() === scope.contractAddress.toLowerCase(),
    );
  }

  async getPlanet(tokenId: string, scope: PlanetScope) {
    const planet = this.planets.get(`${scope.chainId}:${scope.contractAddress.toLowerCase()}:${tokenId}`);
    if (!planet) return undefined;
    return planet;
  }

  seedPlanet(planet: IndexedPlanetRecord) {
    this.planets.set(planetKey(planet), planet);
  }
}
