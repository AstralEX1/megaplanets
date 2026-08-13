import { describe, expect, it, vi } from 'vitest';
import { getLiveRevealCandidates } from './planetReveal';

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const;

describe('getLiveRevealCandidates', () => {
  it('filters burned or transferred tickets before a batch transaction', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(ACCOUNT)
      .mockRejectedValueOnce(new Error('ERC721 nonexistent token'))
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000002');
    const candidates = [
      { ticketId: 1n, logIndex: 1n },
      { ticketId: 2n, logIndex: 2n },
      { ticketId: 3n, logIndex: 3n },
    ];

    const result = await getLiveRevealCandidates(
      { readContract } as never,
      ACCOUNT,
      candidates,
      '0x0000000000000000000000000000000000000003',
    );

    expect(result.live).toEqual([candidates[0]]);
    expect(result.unavailable.map(({ planet }) => planet.ticketId)).toEqual([2n, 3n]);
  });
});
