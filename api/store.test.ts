import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDailySnapshot } from './scoring';
import { MEGAPLANETS_TICKET_START_BLOCK } from './config';
import { FileEligibilityStore, MemoryEligibilityStore } from './store';
import type { MegasteraProof } from './eligibility';

const tempDirectories: string[] = [];
const snapshot = createDailySnapshot({ blockNumber: 42n, capturedAt: '2026-08-11T00:00:00.000Z', holdings: [] });
const proof: MegasteraProof = {
  recipient: '0x1111111111111111111111111111111111111111',
  ticketId: 456n,
  drawingId: 123n,
  normals: [2, 7, 14, 22, 29],
  bonusBall: 9,
  originTxHash: `0x${'ab'.repeat(32)}`,
  blockNumber: 44_997_183n,
  logIndex: 4n,
  blockHash: `0x${'cd'.repeat(32)}`,
  purchasedAt: new Date('2026-08-11T00:00:00.000Z'),
  chainId: 84_532,
  jackpotAddress: '0x465dA3c859f193A3807386387bEE941B2A4c3279',
};

describe('legacy snapshot preservation during eligibility rewind', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it.each([
    ['memory', async () => new MemoryEligibilityStore()],
    ['file', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'megaplanets-store-'));
      tempDirectories.push(directory);
      return new FileEligibilityStore(join(directory, 'store.json'));
    }],
  ])('preserves snapshots outside the owned ticket rewind boundary during %s rewind', async (_name, createStore) => {
    const store = await createStore();
    await store.saveSnapshot(snapshot);
    await store.setCursor(43n, `0x${'11'.repeat(32)}`);

    await store.rewind(43n);

    expect(await store.getSnapshot(42n)).toEqual(snapshot);
    expect(await store.getCursor()).toBeUndefined();
  });
});

describe('Megastera proof persistence', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it.each([
    ['memory', async () => new MemoryEligibilityStore()],
    ['file', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'megaplanets-proof-store-'));
      tempDirectories.push(directory);
      return new FileEligibilityStore(join(directory, 'store.json'));
    }],
  ])('stores an idempotent proof and recovers it by receipt reference (%s)', async (_name, createStore) => {
    const store = await createStore();

    await store.saveProof(proof);
    await store.saveProof({ ...proof, recipient: proof.recipient.toLowerCase() as `0x${string}` });

    await expect(store.getProof({ transactionHash: proof.originTxHash, logIndex: proof.logIndex })).resolves.toMatchObject({
      ticketId: proof.ticketId,
      originTxHash: proof.originTxHash,
      logIndex: proof.logIndex,
      source: expect.any(String),
    });
    await expect(store.getProof({ originTxHash: proof.originTxHash, logIndex: proof.logIndex })).resolves.toMatchObject({ ticketId: proof.ticketId });
    await expect(store.saveProof({ ...proof, ticketId: 457n })).rejects.toThrow(/conflicts/i);
  });

  it.each([
    ['memory', async () => new MemoryEligibilityStore()],
    ['file', async () => {
      const directory = await mkdtemp(join(tmpdir(), 'megaplanets-proof-list-'));
      tempDirectories.push(directory);
      return new FileEligibilityStore(join(directory, 'store.json'));
    }],
  ])('lists proofs by normalized recipient with bounded newest-first pagination (%s)', async (_name, createStore) => {
    const store = await createStore();
    const older = { ...proof, ticketId: 400n, blockNumber: 44_997_000n, logIndex: 1n };
    const newer = { ...proof, ticketId: 401n, blockNumber: 44_997_001n, logIndex: 2n };
    const otherWallet = { ...proof, ticketId: 402n, recipient: '0x2222222222222222222222222222222222222222' as const };
    await store.saveProof(older);
    await store.saveProof(newer);
    await store.saveProof(otherWallet);

    await expect(store.listProofs('0x1111111111111111111111111111111111111111', { offset: 0, limit: 1 })).resolves.toEqual({
      total: 2,
      offset: 0,
      limit: 1,
      proofs: [expect.objectContaining({ ticketId: 401n, logIndex: 2n })],
    });
    await expect(store.listProofs('0x1111111111111111111111111111111111111111', { offset: 1, limit: 1 })).resolves.toEqual({
      total: 2,
      offset: 1,
      limit: 1,
      proofs: [expect.objectContaining({ ticketId: 400n, logIndex: 1n })],
    });
  });
});

describe('legacy file eligibility store migration', () => {
  afterEach(async () => {
    await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  });

  it('replays a legacy cursor once when the activation cursor epoch is missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'megaplanets-store-v1-'));
    tempDirectories.push(directory);
    const filePath = join(directory, 'store.json');
    await writeFile(filePath, JSON.stringify({ version: 1, cursor: '123', tickets: {}, vouchers: {} }));

    const cursor = await new FileEligibilityStore(filePath).getCursor();

    expect(cursor).toBeUndefined();
  });

  it('persists the activation cursor epoch after the replay boundary is committed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'megaplanets-store-epoch-'));
    tempDirectories.push(directory);
    const store = new FileEligibilityStore(join(directory, 'store.json'));
    await store.setCursor(MEGAPLANETS_TICKET_START_BLOCK + 50n, `0x${'22'.repeat(32)}`);
    expect(await store.getCursor()).toEqual({
      nextBlock: MEGAPLANETS_TICKET_START_BLOCK + 50n,
      lastBlockHash: `0x${'22'.repeat(32)}`,
    });
  });
});
