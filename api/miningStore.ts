import type { PrismaClient } from './generated/prisma/client';
import { calculateLifetimeMinerals, MINERAL_SCALE } from './mining';
import type { PlanetScope } from './stage2Store';

const BASIS_POINTS = 10_000n;

export async function getPlanetMiningSnapshot(
  prisma: PrismaClient,
  tokenId: string,
  now: Date,
  scope: PlanetScope,
) {
  const planet = await prisma.planet.findFirst({
    where: {
      tokenId,
      chainId: scope.chainId,
      contractAddress: scope.contractAddress.toLowerCase(),
      ownerAddress: { not: '0x0000000000000000000000000000000000000000' },
    },
    select: {
      tokenId: true,
      ownerAddress: true,
      baseMineralsPerDay: true,
      mintedAt: true,
    },
  });
  if (
    !planet ||
    planet.baseMineralsPerDay === null ||
    planet.ownerAddress.toLowerCase() === '0x0000000000000000000000000000000000000000'
  )
    return undefined;
  const lifetimeMicros = calculateLifetimeMinerals({
    baseMineralsPerDay: planet.baseMineralsPerDay,
    mintedAt: planet.mintedAt,
    asOf: now,
  });
  return {
    tokenId: planet.tokenId.toFixed(0),
    ownerAddress: planet.ownerAddress,
    baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
    multiplierBps: BASIS_POINTS.toString(),
    pendingMicros: '0',
    earnedMicros: lifetimeMicros.toString(),
    activeSince: planet.mintedAt.toISOString(),
  };
}

export async function getWalletMiningSnapshot(
  prisma: PrismaClient,
  ownerAddress: string,
  now: Date,
  scope: PlanetScope,
) {
  if (ownerAddress.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return {
      ownerAddress,
      asOf: now.toISOString(),
      ownedPlanetCount: 0,
      pendingMicros: '0',
      earnedMicros: '0',
      effectiveMineralsPerDayMicros: '0',
      planets: [],
    };
  }
  const planets = await prisma.planet.findMany({
    where: {
      ownerAddress,
      chainId: scope.chainId,
      contractAddress: scope.contractAddress.toLowerCase(),
      baseMineralsPerDay: { not: null },
    },
    select: {
      tokenId: true,
      baseMineralsPerDay: true,
      mintedAt: true,
    },
  });

  let lifetimeMicros = 0n;
  let effectiveMineralsPerDayMicros = 0n;
  const planetSnapshots = planets.flatMap((planet) => {
    if (planet.baseMineralsPerDay === null) return [];
    const lifetime = calculateLifetimeMinerals({
      baseMineralsPerDay: planet.baseMineralsPerDay,
      mintedAt: planet.mintedAt,
      asOf: now,
    });
    const effectiveRate = planet.baseMineralsPerDay * MINERAL_SCALE;
    lifetimeMicros += lifetime;
    effectiveMineralsPerDayMicros += effectiveRate;
    return [
      {
        tokenId: planet.tokenId.toFixed(0),
        baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
        multiplierBps: BASIS_POINTS.toString(),
        effectiveMineralsPerDayMicros: effectiveRate.toString(),
        pendingMicros: '0',
        earnedMicros: lifetime.toString(),
        activeSince: planet.mintedAt.toISOString(),
      },
    ];
  });

  return {
    ownerAddress,
    asOf: now.toISOString(),
    ownedPlanetCount: planets.length,
    pendingMicros: '0',
    earnedMicros: lifetimeMicros.toString(),
    effectiveMineralsPerDayMicros: effectiveMineralsPerDayMicros.toString(),
    planets: planetSnapshots,
  };
}
