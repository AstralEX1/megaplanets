import { describe, expect, it } from 'vitest';
import { getLogsAdaptive, readWithRpcFallback } from './rpc';

describe('getLogsAdaptive', () => {
  it('shrinks a rejected range and grows after recovery', async () => {
    const calls: Array<[bigint, bigint]> = [];
    const logs = await getLogsAdaptive({ fromBlock: 0n, toBlock: 9n, initialRange: 8n, minRange: 2n, maxRange: 8n, sleep: async () => undefined }, async (from, to) => {
      calls.push([from, to]);
      if (to - from + 1n > 4n) throw new Error('provider range limit');
      return [Number(from)];
    });
    expect(logs).toEqual([0, 4, 8]);
    expect(calls[0]).toEqual([0n, 7n]);
    expect(calls).toContainEqual([0n, 3n]);
  });
});

describe('readWithRpcFallback', () => {
  it('uses the next endpoint when the primary endpoint cannot serve history', async () => {
    const calls: string[] = [];
    const result = await readWithRpcFallback(
      ['primary', 'archive'],
      async (url) => {
        calls.push(url);
        if (url === 'primary') throw new Error('receipt not found');
        return { status: 'success' };
      },
    );

    expect(result).toEqual({ status: 'success' });
    expect(calls).toEqual(['primary', 'archive']);
  });

  it('reports the final provider error when every endpoint fails', async () => {
    await expect(
      readWithRpcFallback(['primary', 'archive'], async (url) => {
        throw new Error(`${url} failed`);
      }),
    ).rejects.toThrow('archive failed');
  });
});
