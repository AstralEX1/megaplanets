import type { Prisma, PrismaClient } from './generated/prisma/client';
import { accrueMinerals, getSameTypeMultipliers, MINERAL_SCALE } from './mining';

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
): Promise<void> {
  const planets = await transaction.planet.findMany({
    where: { ownerAddress, baseMineralsPerDay: { not: null }, planetType: { not: null } },
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
): Promise<void> {
  const planets = await transaction.planet.findMany({
    where: { ownerAddress, baseMineralsPerDay: { not: null }, planetType: { not: null } },
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
): Promise<void> {
  await settleWalletMiningRates(transaction, ownerAddress, effectiveAt);
  await repriceWalletMiningRates(transaction, ownerAddress, effectiveAt);
}

/** Starts mining for indexed planets that predate the mining rollout, without retroactive accrual. */
export async function initializeMissingMiningStates(prisma: PrismaClient, startedAt: Date): Promise<number> {
  const owners = await prisma.planet.findMany({
    where: {
      ownerAddress: { not: '0x0000000000000000000000000000000000000000' },
      baseMineralsPerDay: { not: null },
      planetType: { not: null },
      accrualState: null,
    },
    select: { ownerAddress: true },
    distinct: ['ownerAddress'],
  });
  for (const { ownerAddress } of owners) {
    await prisma.$transaction((transaction) => repriceWalletMiningRates(transaction, ownerAddress, startedAt));
  }
  return owners.length;
}

export async function getPlanetMiningSnapshot(prisma: PrismaClient, tokenId: string, now: Date) {
  const planet = await prisma.planet.findFirst({
    where: { tokenId },
    include: { accrualState: true },
  });
  if (!planet?.accrualState || planet.baseMineralsPerDay === null) return undefined;
  const active = accrueMinerals({
    baseMineralsPerDay: planet.baseMineralsPerDay,
    multiplierBps: BigInt(planet.accrualState.multiplierBps),
    elapsedMilliseconds: elapsedMilliseconds(planet.accrualState.startedAt, now),
    remainder: planet.accrualState.remainder,
  });
  const ledger = await prisma.mineralLedgerEntry.aggregate({
    where: { planetId: planet.id, ownerAddress: planet.ownerAddress },
    _sum: { amountMicros: true },
  });
  const settledMicros = ledger._sum.amountMicros ?? 0n;
  return {
    tokenId: planet.tokenId.toFixed(0),
    ownerAddress: planet.ownerAddress,
    baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
    multiplierBps: planet.accrualState.multiplierBps.toString(),
    pendingMicros: active.minerals.toString(),
    earnedMicros: (settledMicros + active.minerals).toString(),
    activeSince: planet.accrualState.startedAt.toISOString(),
  };
}

export async function getWalletMiningSnapshot(prisma: PrismaClient, ownerAddress: string, now: Date) {
  const [planets, ledger] = await Promise.all([
    prisma.planet.findMany({
      where: { ownerAddress, baseMineralsPerDay: { not: null }, accrualState: { isNot: null } },
      select: {
        id: true,
        tokenId: true,
        baseMineralsPerDay: true,
        accrualState: { select: { startedAt: true, multiplierBps: true, remainder: true } },
      },
    }),
    prisma.mineralLedgerEntry.findMany({
      where: { ownerAddress },
      select: { planetId: true, amountMicros: true },
    }),
  ]);

  const settledByPlanet = new Map<string, bigint>();
  let settledMicros = 0n;
  for (const entry of ledger) {
    settledMicros += entry.amountMicros;
    settledByPlanet.set(entry.planetId, (settledByPlanet.get(entry.planetId) ?? 0n) + entry.amountMicros);
  }

  let pendingMicros = 0n;
  let effectiveMineralsPerDayMicros = 0n;
  const planetSnapshots = planets.flatMap((planet) => {
    if (!planet.accrualState || planet.baseMineralsPerDay === null) return [];
    const pending = accrueMinerals({
      baseMineralsPerDay: planet.baseMineralsPerDay,
      multiplierBps: BigInt(planet.accrualState.multiplierBps),
      elapsedMilliseconds: elapsedMilliseconds(planet.accrualState.startedAt, now),
      remainder: planet.accrualState.remainder,
    }).minerals;
    const effectiveRate = planet.baseMineralsPerDay * MINERAL_SCALE
      * BigInt(planet.accrualState.multiplierBps) / BASIS_POINTS;
    pendingMicros += pending;
    effectiveMineralsPerDayMicros += effectiveRate;
    return [{
      tokenId: planet.tokenId.toFixed(0),
      baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
      multiplierBps: planet.accrualState.multiplierBps.toString(),
      effectiveMineralsPerDayMicros: effectiveRate.toString(),
      pendingMicros: pending.toString(),
      earnedMicros: ((settledByPlanet.get(planet.id) ?? 0n) + pending).toString(),
      activeSince: planet.accrualState.startedAt.toISOString(),
    }];
  });

  return {
    ownerAddress,
    asOf: now.toISOString(),
    ownedPlanetCount: planets.length,
    pendingMicros: pendingMicros.toString(),
    earnedMicros: (settledMicros + pendingMicros).toString(),
    effectiveMineralsPerDayMicros: effectiveMineralsPerDayMicros.toString(),
    planets: planetSnapshots,
  };
}
