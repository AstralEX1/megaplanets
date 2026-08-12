import { describe, expect, it } from 'vitest';
import { getLogsAdaptive } from './rpc';

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
