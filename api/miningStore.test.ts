import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import { getPlanetMiningSnapshot, getWalletMiningSnapshot } from './miningStore';

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
