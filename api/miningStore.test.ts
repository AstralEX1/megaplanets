import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import { getWalletMiningSnapshot, settleWalletMiningRates } from './miningStore';

describe('settleWalletMiningRates', () => {
  it('persists the fractional remainder in each settlement ledger entry', async () => {
    const state = {
      id: 'state-1', planetId: 'planet-1', ownerAddress: '0x0000000000000000000000000000000000000001',
      startedAt: new Date('2026-08-10T00:00:00.000Z'), multiplierBps: 10_000, remainder: 0n,
    };
    const entries: Array<{ fractionalRemainder: bigint }> = [];
    const transaction = {
      planet: { findMany: async () => [{ id: 'planet-1', baseMineralsPerDay: 1n, planetType: 'GAIA' }] },
      planetAccrualState: {
        findMany: async () => [state],
        update: async ({ data }: { data: Partial<typeof state> }) => Object.assign(state, data),
      },
      mineralLedgerEntry: { create: async ({ data }: { data: { fractionalRemainder: bigint } }) => entries.push(data) },
    } as never;

    await settleWalletMiningRates(transaction, state.ownerAddress, new Date('2026-08-10T00:00:00.001Z'));

    expect(entries).toEqual([expect.objectContaining({ fractionalRemainder: 10_000_000_000n })]);
    expect(state.remainder).toBe(10_000_000_000n);
  });
});

describe('getWalletMiningSnapshot', () => {
  it('includes settled earnings from transferred Planets and pending earnings from current Planets', async () => {
    const ownerAddress = '0x0000000000000000000000000000000000000001';
    const prisma = {
      planet: {
        findMany: async () => [
          {
            id: 'planet-1',
            tokenId: { toFixed: () => '1' },
            baseMineralsPerDay: 86_400n,
            accrualState: {
              startedAt: new Date('2026-08-10T00:00:00.000Z'),
              multiplierBps: 10_000,
              remainder: 0n,
            },
          },
          {
            id: 'planet-2',
            tokenId: { toFixed: () => '2' },
            baseMineralsPerDay: 172_800n,
            accrualState: {
              startedAt: new Date('2026-08-10T00:00:00.000Z'),
              multiplierBps: 10_500,
              remainder: 0n,
            },
          },
        ],
      },
      mineralLedgerEntry: {
        findMany: async () => [
          { planetId: 'planet-1', amountMicros: 3_000_000n },
          { planetId: 'planet-2', amountMicros: 4_000_000n },
        ],
      },
    } as unknown as PrismaClient;

    const snapshot = await getWalletMiningSnapshot(prisma, ownerAddress, new Date('2026-08-10T00:00:01.000Z'));

    expect(snapshot).toEqual({
      ownerAddress,
      asOf: '2026-08-10T00:00:01.000Z',
      ownedPlanetCount: 2,
      pendingMicros: '3100000',
      earnedMicros: '10100000',
      effectiveMineralsPerDayMicros: '267840000000',
      planets: [
        {
          tokenId: '1',
          baseMineralsPerDay: '86400',
          multiplierBps: '10000',
          effectiveMineralsPerDayMicros: '86400000000',
          pendingMicros: '1000000',
          earnedMicros: '4000000',
          activeSince: '2026-08-10T00:00:00.000Z',
        },
        {
          tokenId: '2',
          baseMineralsPerDay: '172800',
          multiplierBps: '10500',
          effectiveMineralsPerDayMicros: '181440000000',
          pendingMicros: '2100000',
          earnedMicros: '6100000',
          activeSince: '2026-08-10T00:00:00.000Z',
        },
      ],
    });
  });
});
