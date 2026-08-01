/**
 * ---
 * @customize  Dev-mode boot diagnostics.
 *
 *             Houses two unrelated boot-time concerns:
 *               1. `BigInt.prototype.toJSON` polyfill — global, runs in all
 *                  environments. Megapot reads return uint256 → bigint
 *                  everywhere; the polyfill catches any rogue
 *                  `JSON.stringify` in dev tooling, wallet SES shims, error
 *                  reporters, or observer notify paths.
 *               2. Placeholder + config warnings — gated on
 *                  `import.meta.env.DEV` so production stays silent.
 *                  Catches the three most common hurried-forker footguns:
 *                  shipping with the unchanged REFERRER_ADDRESS, the
 *                  unchanged TICKET_SOURCE, or a missing
 *                  VITE_WALLETCONNECT_PROJECT_ID (which silently degrades
 *                  the wallet picker — see `src/config/wagmi.ts`).
 *
 *             Imported once from `main.tsx`; no exports — pure side effects.
 * ---
 */
import { stringToHex } from 'viem';
import { DEFAULT_REFERRER_ADDRESS, REFERRER_ADDRESS, TICKET_SOURCE } from './contracts';

// Belt + suspenders for bigint JSON serialization. See `main.tsx` for the
// rationale — keep alongside `hashFn` from wagmi/query so nothing in the
// React tree can blow up on a bigint serialization.
// biome-ignore lint/suspicious/noExplicitAny: BigInt.prototype.toJSON is non-standard
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

if (import.meta.env.DEV) {
  if (REFERRER_ADDRESS.toLowerCase() !== DEFAULT_REFERRER_ADDRESS.toLowerCase()) {
    // biome-ignore lint/suspicious/noConsole: deliberate dev-mode diagnostic
    console.warn(
      '[megaplanets] VITE_REFERRER_ADDRESS overrides the approved project referrer. Confirm this is intentional before testing ticket purchases.',
    );
  }
  const REQUIRED_SOURCE = stringToHex('MEGAPLANETS_V1', { size: 32 });
  if (TICKET_SOURCE !== REQUIRED_SOURCE) {
    // biome-ignore lint/suspicious/noConsole: deliberate dev-mode diagnostic
    console.warn(
      '[megaplanets] TICKET_SOURCE must remain MEGAPLANETS_V1 so ticket eligibility can be verified from on-chain events.',
    );
  }
  if (!import.meta.env.VITE_WALLETCONNECT_PROJECT_ID) {
    // biome-ignore lint/suspicious/noConsole: deliberate dev-mode diagnostic
    console.warn(
      '[megapot] VITE_WALLETCONNECT_PROJECT_ID is empty — degraded wallet picker. Only injected wallets (MetaMask extension, Rabby, Brave, Phantom, etc.) and Coinbase Wallet are available; the WalletConnect QR modal, Rainbow, and MetaMask mobile deep links are disabled. Get a free projectId at https://cloud.walletconnect.com to enable the full RainbowKit modal.',
    );
  }
}
