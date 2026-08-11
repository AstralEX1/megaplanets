import { describe, expect, it } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID } from './config';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaPlanetIndexStore, type PlanetTransferEvent } from './planetIndexer';

const sender = '0x0000000000000000000000000000000000000001' as const;
const receiver = '0x0000000000000000000000000000000000000002' as const;
const contractAddress = '0x0000000000000000000000000000000000000003' as const;
const zero = '0x0000000000000000000000000000000000000000' as const;
const effectiveAt = new Date('2026-08-10T00:00:00.000Z');

type State = { planetId: string; ownerAddress: string; startedAt: Date; multiplierBps: number; remainder: bigint };
type Planet = { id: string; baseMineralsPerDay: bigint; planetType: string };

function event(to: typeof receiver | typeof zero): PlanetTransferEvent {
  return {
    chainId: BASE_SEPOLIA_CHAIN_ID,
    contractAddress,
    tokenId: 42n,
    from: sender,
    to,
    transactionHash: `0x${'11'.repeat(32)}`,
    blockNumber: 42n,
    blockHash: `0x${'22'.repeat(32)}`,
    logIndex: 1,
    blockTimestamp: effectiveAt,
  };
}

function makeStore(compositions: Planet[][], states: Map<string, State>, target: Planet): PrismaPlanetIndexStore {
  let compositionCall = 0;
  let owner: string = sender;
  const transaction = {
    planet: {
      findUnique: async () => ({ ...target, ownerAddress: owner }),
      findMany: async () => compositions[compositionCall++] ?? [],
      update: async ({ data }: { data: { ownerAddress: string } }) => { owner = data.ownerAddress; },
    },
    planetOwnershipHistory: { create: async () => undefined },
    planetAccrualState: {
      findMany: async () => [...states.values()],
      update: async ({ where, data }: { where: { planetId: string }; data: Partial<State> }) => {
        const state = states.get(where.planetId);
        if (state) Object.assign(state, data);
      },
      updateMany: async ({ where, data }: { where: { planetId: string; ownerAddress: string }; data: Partial<State> }) => {
        const state = states.get(where.planetId);
        if (state?.ownerAddress === where.ownerAddress) Object.assign(state, data);
      },
      deleteMany: async ({ where }: { where: { planetId: string } }) => { states.delete(where.planetId); },
    },
    mineralLedgerEntry: { create: async () => undefined },
    processedBlockchainEvent: { create: async () => undefined },
  };
  const prisma = {
    processedBlockchainEvent: { findUnique: async () => null },
  } as unknown as PrismaClient;
  const transactionClient = transaction;
  (prisma as unknown as { $transaction: (callback: (transaction: typeof transactionClient) => Promise<void>) => Promise<void> }).$transaction = async (callback) => callback(transactionClient);
  return new PrismaPlanetIndexStore(prisma);
}

describe('Planet mining transition repricing', () => {
  it('removes the sender same-type bonus from the remaining Planet', async () => {
    const remaining = { id: 'planet-2', baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const target = { id: 'planet-1', baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const states = new Map<string, State>([
      ['planet-1', { planetId: 'planet-1', ownerAddress: sender, startedAt: effectiveAt, multiplierBps: 10_500, remainder: 0n }],
      ['planet-2', { planetId: 'planet-2', ownerAddress: sender, startedAt: effectiveAt, multiplierBps: 10_500, remainder: 0n }],
    ]);
    const store = makeStore([[target, remaining], [], [remaining], [target]], states, target);

    await store.recordTransfer(event(receiver));

    expect(states.get('planet-2')?.multiplierBps).toBe(10_000);
  });

  it('adds the receiver same-type bonus after transfer', async () => {
    const target = { id: 'planet-1', baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const receiverPlanet = { id: 'planet-3', baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const states = new Map<string, State>([
      ['planet-1', { planetId: 'planet-1', ownerAddress: sender, startedAt: effectiveAt, multiplierBps: 10_000, remainder: 0n }],
      ['planet-3', { planetId: 'planet-3', ownerAddress: receiver, startedAt: effectiveAt, multiplierBps: 10_000, remainder: 0n }],
    ]);
    const store = makeStore([[target], [receiverPlanet], [], [target, receiverPlanet]], states, target);

    await store.recordTransfer(event(receiver));

    expect(states.get('planet-1')?.multiplierBps).toBe(10_500);
    expect(states.get('planet-3')?.multiplierBps).toBe(10_500);
  });

  it('stops accrual for a burned Planet by deleting its active state', async () => {
    const target = { id: 'planet-1', baseMineralsPerDay: 86_400n, planetType: 'volcanic' };
    const states = new Map<string, State>([
      ['planet-1', { planetId: 'planet-1', ownerAddress: sender, startedAt: effectiveAt, multiplierBps: 10_000, remainder: 0n }],
    ]);
    const store = makeStore([[target], []], states, target);

    await store.recordTransfer(event(zero));

    expect(states.has('planet-1')).toBe(false);
  });
});
