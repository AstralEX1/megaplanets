// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentLeaderboard } from './useLeaderboard';
import { fetchWalletMining } from './useWalletMining';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;

afterEach(() => vi.unstubAllGlobals());

describe('backend mining fetchers', () => {
  it('loads one aggregated wallet mining snapshot', async () => {
    const payload = { mining: { ownerAddress: ADDRESS, asOf: '2026-08-12T12:00:00.000Z', ownedPlanetCount: 1, pendingMicros: '1', earnedMicros: '2', effectiveMineralsPerDayMicros: '3', planets: [] } };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWalletMining(ADDRESS)).resolves.toEqual(payload.mining);
    expect(fetchMock).toHaveBeenCalledWith(`/api/wallets/${ADDRESS}/mining`);
  });

  it('surfaces an explicit error when the leaderboard backend fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));

    await expect(fetchCurrentLeaderboard()).rejects.toThrow('Leaderboard returned HTTP 503.');
  });
});
