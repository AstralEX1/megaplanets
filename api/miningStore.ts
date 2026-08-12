import type { Prisma, PrismaClient } from './generated/prisma/client';
import {
  accrueMinerals,
  calculateLifetimeMinerals,
  getSameTypeMultipliers,
  MINERAL_SCALE,
} from './mining';
import type { PlanetScope } from './stage2Store';

const BASIS_POINTS = 10_000n;

function elapsedMilliseconds(startedAt: Date, endedAt: Date): bigint {
  const elapsed = endedAt.getTime() - startedAt.getTime();
  if (elapsed < 0) throw new Error('Mining settlement cannot end before it starts.');
  return BigInt(elapsed);
}

/** Settles active mining intervals without changing the current composition's rates. */
export async function settleWalletMiningRates(
  transaction: Prisma.TransactionClient,
  ownerAddress: string,
  effectiveAt: Date,
  scope: PlanetScope,
): Promise<void> {
  const planets = await transaction.planet.findMany({
    where: {
      ownerAddress,
      chainId: scope.chainId,
      contractAddress: scope.contractAddress.toLowerCase(),
      baseMineralsPerDay: { not: null },
      planetType: { not: null },
    },
    select: { id: true, baseMineralsPerDay: true, planetType: true },
  });
  if (planets.length === 0) return;

  const states = await transaction.planetAccrualState.findMany({
    where: { planetId: { in: planets.map((planet) => planet.id) } },
  });
  const statesByPlanet = new Map(states.map((state) => [state.planetId, state]));

  for (const planet of planets) {
    const state = statesByPlanet.get(planet.id);
    if (!state) continue;
    const elapsed = elapsedMilliseconds(state.startedAt, effectiveAt);
    if (elapsed > 0n) {
      const accrued = accrueMinerals({
        baseMineralsPerDay: planet.baseMineralsPerDay ?? 0n,
        multiplierBps: BigInt(state.multiplierBps),
        elapsedMilliseconds: elapsed,
        remainder: state.remainder,
      });
      await transaction.mineralLedgerEntry.create({
        data: {
          planetId: planet.id,
          ownerAddress: state.ownerAddress,
          startedAt: state.startedAt,
          endedAt: effectiveAt,
          baseMineralsPerDay: planet.baseMineralsPerDay ?? 0n,
          multiplierBps: state.multiplierBps,
          amountMicros: accrued.minerals,
          fractionalRemainder: accrued.remainder,
        },
      });
      await transaction.planetAccrualState.update({
        where: { planetId: planet.id },
        data: { startedAt: effectiveAt, remainder: accrued.remainder },
      });
    }
  }
}

/** Reprices a wallet from its current ownership composition without settling it. */
export async function repriceWalletMiningRates(
  transaction: Prisma.TransactionClient,
  ownerAddress: string,
  effectiveAt: Date,
  scope: PlanetScope,
): Promise<void> {
  const planets = await transaction.planet.findMany({
    where: {
      ownerAddress,
      chainId: scope.chainId,
      contractAddress: scope.contractAddress.toLowerCase(),
      baseMineralsPerDay: { not: null },
      planetType: { not: null },
    },
    select: { id: true, planetType: true },
  });
  const multipliers = getSameTypeMultipliers(
    planets.map((planet) => ({ planetId: planet.id, planetType: planet.planetType ?? '' })),
  );
  const states = await transaction.planetAccrualState.findMany({
    where: { planetId: { in: planets.map((planet) => planet.id) } },
  });
  const statesByPlanet = new Map(states.map((state) => [state.planetId, state]));
  for (const planet of planets) {
    const multiplierBps = Number(multipliers[planet.id]);
    const state = statesByPlanet.get(planet.id);
    if (!state) {
      await transaction.planetAccrualState.create({
        data: { planetId: planet.id, ownerAddress, startedAt: effectiveAt, multiplierBps },
      });
    } else if (state.multiplierBps !== multiplierBps || state.ownerAddress !== ownerAddress) {
      await transaction.planetAccrualState.update({
        where: { planetId: planet.id },
        data: { ownerAddress, multiplierBps },
      });
    }
  }
}

/** Settles the pre-change composition then refreshes rates for the same composition. */
export async function refreshWalletMiningRates(
  transaction: Prisma.TransactionClient,
  ownerAddress: string,
  effectiveAt: Date,
  scope: PlanetScope,
): Promise<void> {
  await settleWalletMiningRates(transaction, ownerAddress, effectiveAt, scope);
  await repriceWalletMiningRates(transaction, ownerAddress, effectiveAt, scope);
}

/** Starts mining for indexed planets that predate the mining rollout, without retroactive accrual. */
export async function initializeMissingMiningStates(
  prisma: PrismaClient,
  startedAt: Date,
  scope: PlanetScope,
): Promise<number> {
  const owners = await prisma.planet.findMany({
    where: {
      chainId: scope.chainId,
      contractAddress: scope.contractAddress.toLowerCase(),
      ownerAddress: { not: '0x0000000000000000000000000000000000000000' },
      baseMineralsPerDay: { not: null },
      planetType: { not: null },
      accrualState: null,
    },
    select: { ownerAddress: true },
    distinct: ['ownerAddress'],
  });
  for (const { ownerAddress } of owners) {
    await prisma.$transaction((transaction) =>
      repriceWalletMiningRates(transaction, ownerAddress, startedAt, scope),
    );
  }
  return owners.length;
}

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
