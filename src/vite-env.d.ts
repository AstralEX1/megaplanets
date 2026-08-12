/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN: 'mainnet' | 'testnet';
  readonly VITE_RPC_URL: string;
  /** Optional comma-separated RPC endpoints used for archive/history failover. */
  readonly VITE_RPC_FALLBACK_URLS?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Optional Megapot Data API key (mpk_live_…). Anonymous tier without one. */
  readonly VITE_MEGAPOT_API_KEY?: string;
  /** Base URL for the server-side Planet voucher service. Empty disables Planet minting. */
  readonly VITE_PLANET_API_BASE_URL?: string;
  /** Shared base URL for Planet, mining, leaderboard, and voucher APIs. */
  readonly VITE_BACKEND_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
