import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDailySnapshot } from './scoring';
import { MEGAPLANETS_TICKET_START_BLOCK } from './config';
import { FileEligibilityStore, MemoryEligibilityStore } from './store';

const tempDirectories: string[] = [];
const snapshot = createDailySnapshot({ blockNumber: 42n, capturedAt: '2026-08-11T00:00:00.000Z', holdings: [] });

describe('eligibility store rewind', () => {
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
