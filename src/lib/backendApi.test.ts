import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendApiUrl, fetchMegasteraProofPage } from './backendApi';

describe('backendApiUrl', () => {
  it('keeps same-origin routes relative', () => {
    expect(backendApiUrl('/api/planets', '')).toBe('/api/planets');
  });

  it('resolves routes against a separate origin', () => {
    expect(backendApiUrl('/api/leaderboard/current', 'https://api.example.test/v2')).toBe(
      'https://api.example.test/api/leaderboard/current',
    );
  });
});

describe('fetchMegasteraProofPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches and validates a bounded server proof page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          proofs: [
            {
              recipient: '0x0000000000000000000000000000000000000001',
              ticketId: '7',
              drawingId: '218',
              normals: [4, 11, 17, 26, 39],
              bonusBall: 66,
              originTxHash: `0x${'a'.repeat(64)}`,
              blockNumber: '45000000',
              blockHash: `0x${'b'.repeat(64)}`,
              logIndex: '4',
              chainId: 84532,
              jackpotAddress: '0x465dA3c859f193A3807386387bEE941B2A4c3279',
              source: `0x${Buffer.from('MEGAPLANETS_V1').toString('hex').padEnd(64, '0')}`,
            },
          ],
          total: 1,
          offset: 0,
          limit: 100,
        }),
        { status: 200 },
      ),
    );

    const page = await fetchMegasteraProofPage('0x0000000000000000000000000000000000000001');

    expect(page.proofs[0]?.ticketId).toBe('7');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/api/planets/megastera-proofs?recipient=0x0000000000000000000000000000000000000001&offset=0&limit=100',
      ),
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('fails closed on malformed proof fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ proofs: [{ ticketId: 'not-a-proof' }], total: 1, offset: 0, limit: 100 }),
        { status: 200 },
      ),
    );
    await expect(
      fetchMegasteraProofPage('0x0000000000000000000000000000000000000001'),
    ).rejects.toThrow(/malformed/i);
  });
});
