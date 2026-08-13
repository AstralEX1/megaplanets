import { useQuery } from '@tanstack/react-query';
import { BACKEND_API_BASE_URL, backendApiFetch } from '@/lib/backendApi';

export type PlanetMiningSnapshot = {
  tokenId: string;
  baseMineralsPerDay: string;
  effectiveMineralsPerDayMicros: string;
  earnedMicros: string;
  activeSince: string;
};

export type WalletMiningSnapshot = {
  ownerAddress: `0x${string}`;
  asOf: string;
  ownedPlanetCount: number;
  earnedMicros: string;
  effectiveMineralsPerDayMicros: string;
  planets: PlanetMiningSnapshot[];
};

export async function fetchWalletMining(address: `0x${string}`): Promise<WalletMiningSnapshot> {
  const response = await backendApiFetch(`/api/wallets/${address}/mining`);
  if (!response.ok) throw new Error(`Wallet mining returned HTTP ${response.status}.`);
  return ((await response.json()) as { mining: WalletMiningSnapshot }).mining;
}

export function useWalletMining(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ['megaplanets-backend', BACKEND_API_BASE_URL, 'wallet-mining', address],
    queryFn: () => {
      if (!address) throw new Error('A connected wallet is required.');
      return fetchWalletMining(address);
    },
    enabled: !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
