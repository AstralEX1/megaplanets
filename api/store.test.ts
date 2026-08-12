import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDailySnapshot } from './scoring';
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

  it('migrates a v1 string cursor to the v2 cursor shape', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'megaplanets-store-v1-'));
    tempDirectories.push(directory);
    const filePath = join(directory, 'store.json');
    await writeFile(filePath, JSON.stringify({ version: 1, cursor: '123', tickets: {}, vouchers: {} }));

    const cursor = await new FileEligibilityStore(filePath).getCursor();

    expect(cursor).toEqual({ nextBlock: 123n, lastBlockHash: undefined });
  });
});
