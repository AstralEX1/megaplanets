import { describe, expect, it, vi } from 'vitest';
import { invalidatePostWriteQueries } from './queryInvalidation';

describe('post-write query invalidation', () => {
  it('invalidates every wallet/read surface after a successful write', async () => {
    const queryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    };

    await invalidatePostWriteQueries(queryClient as never);

    const keys = queryClient.invalidateQueries.mock.calls.map(
      ([call]) => call.queryKey,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        ['megapot-api', expect.any(String), 'wallet-tickets-round'],
        ['megapot-api', expect.any(String), 'wallet-tickets'],
        ['megapot-api', expect.any(String), 'wallet-stats'],
        ['megapot-api', expect.any(String), 'wallet-wins'],
        ['megapot-api', 'eligible-planet-tickets'],
        ['megapot-api', expect.any(String), 'indexed-planets'],
      ]),
    );
  });
});
