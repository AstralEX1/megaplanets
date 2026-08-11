import { useQuery } from '@tanstack/react-query';

export type LeaderboardPeriod = {
  id: string;
  startsAt: string;
  endsAt: string;
  finalizedAt?: string | null;
};

export type LeaderboardRow = {
  rank: number;
  walletAddress: `0x${string}`;
  scoreMicros: string;
  effectiveMineralsPerDayMicros: string;
};

export type LeaderboardPage = {
  period: LeaderboardPeriod;
  asOf?: string;
  total: number;
  offset: number;
  limit: number;
  rows: LeaderboardRow[];
};

export type WalletLeaderboardPosition = {
  period: LeaderboardPeriod;
  asOf: string;
  row: LeaderboardRow | null;
  distanceToNextRankMicros: string | null;
};

export type LeaderboardHistory = {
  total: number;
  offset: number;
  limit: number;
  periods: LeaderboardPeriod[];
};

async function readJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

export function fetchCurrentLeaderboard(offset = 0, limit = 50): Promise<LeaderboardPage> {
  return readJson(`/api/leaderboard/current?offset=${offset}&limit=${limit}`, 'Leaderboard');
}

export function fetchWalletLeaderboardPosition(address: `0x${string}`): Promise<WalletLeaderboardPosition> {
  return readJson(`/api/leaderboard/current/${address}`, 'Wallet leaderboard position');
}

export function fetchLeaderboardHistory(offset = 0, limit = 20): Promise<LeaderboardHistory> {
  return readJson(`/api/leaderboard/history?offset=${offset}&limit=${limit}`, 'Leaderboard history');
}

export function fetchArchivedLeaderboard(periodId: string, offset = 0, limit = 50): Promise<LeaderboardPage> {
  return readJson(`/api/leaderboard/weeks/${encodeURIComponent(periodId)}?offset=${offset}&limit=${limit}`, 'Archived leaderboard');
}

export function useCurrentLeaderboard(offset = 0, limit = 50) {
  return useQuery({
    queryKey: ['megaplanets-backend', 'leaderboard', 'current', offset, limit],
    queryFn: () => fetchCurrentLeaderboard(offset, limit),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useWalletLeaderboardPosition(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ['megaplanets-backend', 'leaderboard', 'current-wallet', address],
    queryFn: () => {
      if (!address) throw new Error('A connected wallet is required.');
      return fetchWalletLeaderboardPosition(address);
    },
    enabled: !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useLeaderboardHistory() {
  return useQuery({
    queryKey: ['megaplanets-backend', 'leaderboard', 'history'],
    queryFn: () => fetchLeaderboardHistory(),
    staleTime: 60_000,
  });
}

export function useArchivedLeaderboard(periodId: string | undefined) {
  return useQuery({
    queryKey: ['megaplanets-backend', 'leaderboard', 'week', periodId],
    queryFn: () => {
      if (!periodId) throw new Error('A leaderboard period is required.');
      return fetchArchivedLeaderboard(periodId);
    },
    enabled: !!periodId,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
