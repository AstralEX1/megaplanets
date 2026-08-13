import { describe, expect, it, vi } from 'vitest';
import { getLiveRevealCandidates } from './planetReveal';

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const;

describe('getLiveRevealCandidates', () => {
  it('filters burned, transferred, and already-minted tickets before a batch transaction', async () => {
    const readContract = vi.fn(
      async ({ functionName, args }: { functionName: string; args: [bigint] }) => {
        const ticketId = args[0];
        if (functionName === 'planetMinted') return ticketId === 4n;
        if (ticketId === 2n) throw new Error('ERC721 nonexistent token');
        if (ticketId === 3n) return '0x0000000000000000000000000000000000000002';
        return ACCOUNT;
      },
    );
    const candidates = [
      { ticketId: 1n, logIndex: 1n },
      { ticketId: 2n, logIndex: 2n },
      { ticketId: 3n, logIndex: 3n },
      { ticketId: 4n, logIndex: 4n },
    ];

    const result = await getLiveRevealCandidates(
      { readContract } as never,
      ACCOUNT,
      candidates,
      '0x0000000000000000000000000000000000000003',
      '0x0000000000000000000000000000000000000004',
    );

    expect(result.live).toEqual([candidates[0]]);
    expect(result.unavailable).toEqual([
      { planet: candidates[1], reason: 'burned' },
      { planet: candidates[2], reason: 'transferred' },
      { planet: candidates[3], reason: 'already-minted' },
    ]);
  });

  it('fails closed when an ownership provider error mentions a generic revert', async () => {
    const candidate = { ticketId: 9n, logIndex: 9n };
    const result = await getLiveRevealCandidates(
      {
        readContract: vi
          .fn()
          .mockRejectedValue(new Error('RPC call reverted because upstream is unavailable')),
      } as never,
      ACCOUNT,
      [candidate],
      '0x0000000000000000000000000000000000000003',
      '0x0000000000000000000000000000000000000004',
    );

    expect(result).toEqual({
      live: [],
      unavailable: [{ planet: candidate, reason: 'unreadable' }],
    });
  });
});
