import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import {
  getPlanetMiningSnapshot,
  getWalletMiningSnapshot,
  settleWalletMiningRates,
} from './miningStore';

describe('settleWalletMiningRates', () => {
  it('persists the fractional remainder in each settlement ledger entry', async () => {
    const scope = {
      chainId: 84_532,
      contractAddress: '0x0000000000000000000000000000000000000003' as const,
    };
    const state = {
      id: 'state-1',
      planetId: 'planet-1',
      ownerAddress: '0x0000000000000000000000000000000000000001',
      startedAt: new Date('2026-08-10T00:00:00.000Z'),
      multiplierBps: 10_000,
      remainder: 0n,
    };
    const entries: Array<{ fractionalRemainder: bigint }> = [];
    const transaction = {
      planet: {
        findMany: async ({ where }: { where: Record<string, unknown> }) => {
          expect(where).toMatchObject({
            ownerAddress: state.ownerAddress,
            chainId: scope.chainId,
            contractAddress: scope.contractAddress,
          });
          return [{ id: 'planet-1', baseMineralsPerDay: 1n, planetType: 'GAIA' }];
        },
      },
      planetAccrualState: {
        findMany: async () => [state],
        update: async ({ data }: { data: Partial<typeof state> }) => Object.assign(state, data),
      },
      mineralLedgerEntry: {
        create: async ({ data }: { data: { fractionalRemainder: bigint } }) => entries.push(data),
      },
    } as never;

    await settleWalletMiningRates(
      transaction,
      state.ownerAddress,
      new Date('2026-08-10T00:00:00.001Z'),
      scope,
    );

    expect(entries).toEqual([expect.objectContaining({ fractionalRemainder: 10_000_000_000n })]);
    expect(state.remainder).toBe(10_000_000_000n);
  });
});

describe('getWalletMiningSnapshot', () => {
  it('assigns the full lifetime value to the current owner without reading ledger or accrual state', async () => {
    const ownerAddress = '0x0000000000000000000000000000000000000001';
    const prisma = {
      planet: {
        findMany: async () => [
          {
            id: 'planet-1',
            tokenId: { toFixed: () => '1' },
            baseMineralsPerDay: 86_400n,
            mintedAt: new Date('2026-08-10T00:00:00.000Z'),
          },
          {
            id: 'planet-2',
            tokenId: { toFixed: () => '2' },
            baseMineralsPerDay: 172_800n,
            mintedAt: new Date('2026-08-09T00:00:00.000Z'),
          },
        ],
      },
    } as unknown as PrismaClient;

    const snapshot = await getWalletMiningSnapshot(
      prisma,
      ownerAddress,
      new Date('2026-08-10T00:00:01.000Z'),
      {
        chainId: 84_532,
        contractAddress: '0x0000000000000000000000000000000000000003',
      },
    );

    expect(snapshot).toEqual({
      ownerAddress,
      asOf: '2026-08-10T00:00:01.000Z',
      ownedPlanetCount: 2,
      pendingMicros: '0',
      earnedMicros: '172803000000',
      effectiveMineralsPerDayMicros: '259200000000',
      planets: [
        {
          tokenId: '1',
          baseMineralsPerDay: '86400',
          multiplierBps: '10000',
          effectiveMineralsPerDayMicros: '86400000000',
          pendingMicros: '0',
          earnedMicros: '1000000',
          activeSince: '2026-08-10T00:00:00.000Z',
        },
        {
          tokenId: '2',
          baseMineralsPerDay: '172800',
          multiplierBps: '10000',
          effectiveMineralsPerDayMicros: '172800000000',
          pendingMicros: '0',
          earnedMicros: '172802000000',
          activeSince: '2026-08-09T00:00:00.000Z',
        },
      ],
    });
  });
});

describe('getPlanetMiningSnapshot', () => {
  it('returns the same lifetime value after ownership changes', async () => {
    const prisma = {
      planet: {
        findFirst: async () => ({
          tokenId: { toFixed: () => '7' },
          ownerAddress: '0x0000000000000000000000000000000000000002',
          baseMineralsPerDay: 10n,
          mintedAt: new Date('2026-08-10T00:00:00.000Z'),
        }),
      },
    } as unknown as PrismaClient;

    const snapshot = await getPlanetMiningSnapshot(
      prisma,
      '7',
      new Date('2026-08-12T00:00:00.000Z'),
      { chainId: 84_532, contractAddress: '0x0000000000000000000000000000000000000003' },
    );

    expect(snapshot).toMatchObject({
      tokenId: '7',
      ownerAddress: '0x0000000000000000000000000000000000000002',
      pendingMicros: '0',
      earnedMicros: '20000000',
      activeSince: '2026-08-10T00:00:00.000Z',
    });
  });

  it('does not expose a burned Planet as mining data', async () => {
    const prisma = {
      planet: {
        findFirst: async () => ({
          tokenId: { toFixed: () => '7' },
          ownerAddress: '0x0000000000000000000000000000000000000000',
          baseMineralsPerDay: 10n,
          mintedAt: new Date('2026-08-10T00:00:00.000Z'),
        }),
      },
    } as unknown as PrismaClient;

    await expect(
      getPlanetMiningSnapshot(prisma, '7', new Date('2026-08-12T00:00:00.000Z'), {
        chainId: 84_532,
        contractAddress: '0x0000000000000000000000000000000000000003',
      }),
    ).resolves.toBeUndefined();
  });
});
