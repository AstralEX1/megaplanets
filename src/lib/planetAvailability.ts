export type PlanetAvailability =
  | 'ready'
  | 'unsupported-mainnet'
  | 'missing-contract'
  | 'disconnected'
  | 'wrong-chain';

export function getPlanetAvailability(args: {
  appChain: 'mainnet' | 'testnet';
  walletConnected: boolean;
  walletChainId?: number;
  contractConfigured: boolean;
  baseSepoliaChainId?: number;
}): PlanetAvailability {
  if (args.appChain === 'mainnet') return 'unsupported-mainnet';
  if (!args.contractConfigured) return 'missing-contract';
  if (!args.walletConnected) return 'disconnected';
  if (args.walletChainId !== (args.baseSepoliaChainId ?? 84_532)) return 'wrong-chain';
  return 'ready';
}
