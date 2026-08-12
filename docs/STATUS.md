# Development Status

Last updated: 2026-08-12. The historical full-audit baseline was commit `e0e0e1a` (`main`).

This document is the current implementation snapshot. Product intent remains in
[`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md), architectural boundaries remain in
[`ARCHITECTURE.md`](./ARCHITECTURE.md), and future work is ordered in
[`ROADMAP.md`](./ROADMAP.md).

The public game overview, local setup, deployment gate, and golden Planet GIF gallery
are maintained in the repository root [`README.md`](../README.md). The renderer fixtures
live in [`packages/planet-generator/tests/fixtures/`](../packages/planet-generator/tests/fixtures/)
and are verified byte-for-byte by the focused generator suite.

## Executive summary

MegaPlanets has a substantial local MVP implementation: Megapot ticket purchases,
canonical receipt provenance, deterministic Planet generation, individual and batch
voucher mint flows, a PostgreSQL indexer, lazy mining, same-Type bonuses, weekly
leaderboards, and the corresponding frontend surfaces all exist and are covered by unit
tests. USDC uses an intentional unlimited-approval policy: each route checks the exact
required allowance and only requests `approve(spender, maxUint256)` when insufficient.

It is not yet a releasable end-to-end testnet product. Historical V1 deployments are no
longer part of the active product and the repository intentionally has no default
MegaPlanets contract address. The checked-in contract, ABI, database model, and current
product specification target the deployed seasonless ERC721A V2. The API, database, and
indexer still have no checked-in runtime activation or production backfill configuration.

## Deployment identity record

The successful Base Sepolia deployment at
[`0xa94b947256fa977E63a7970CDf513FDD7632d744`](https://sepolia.basescan.org/address/0xa94b947256fa977E63a7970CDf513FDD7632d744)
is the unsupported ERC-721 **V1**, not ERC721A V2. It was created by
[`0x122fdc39c1c91f5388185c2b843e611d76221d1cddfb1004cdcb7868b0e533ff`](https://sepolia.basescan.org/tx/0x122fdc39c1c91f5388185c2b843e611d76221d1cddfb1004cdcb7868b0e533ff)
at block `44,999,871` on chain ID `84532`.

The runtime exposes the V1-only `mintSpecial` and `SPECIAL_TOKEN_PREFIX` selectors. It
does not expose the V2 `totalSupply`, `planetTokenIdByTicketId`, or
`ticketIdByPlanetTokenId` selectors. The historical broadcast also identifies its base as
OpenZeppelin `ERC721`; the current `contracts/src/MegaPlanets.sol` uses ERC721A and was
introduced after that deployment. This V1 address must never be assigned to an active V2
configuration variable.

The seasonless ERC721A V2 was deployed separately at
`0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` by transaction
`0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c` in block
`45,347,860` on chain ID `84532`. The receipt succeeded, used `2,095,655` gas, and
Sourcify reports an exact source match. A local runtime rehearsal has now completed
against the disposable PostgreSQL database; checked-in frontend/API defaults remain
disabled.

The checked-in deployment/verification commands are:

- `cd contracts && ./script/deploy-v2-approved.sh`
- `set -a; . .env.local; set +a; (cd contracts && ./script/verify-v2-basescan.sh)`

BaseScan verification completed successfully with `BASESCAN_API_KEY` loaded from
the gitignored local `.env.local`.
BaseScan verification by itself does not authorize runtime activation. The runtime
activation gate remains env-only: do not check in defaults, and do not set frontend
`VITE_MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` plus
backend `MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` and
`MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860` until the remaining production operations
gate passes; keep `MEGAPLANETS_LAUNCH_BLOCK=44997183` and
`TICKET_SOURCE=MEGAPLANETS_V1` unchanged. The canonical ticket eligibility boundary is
the first activation-window purchase at block `44,996,796`; the bounded recovery scan
covers that activation window through launch, while normal post-launch purchases remain
eligible. This is intentionally narrower than an unrestricted legacy scan.

## Layer-by-layer state

| Layer | Implemented now | Readiness |
| --- | --- | --- |
| Megapot purchases | Direct 1-10 custom/quick-pick purchases, all-random keeper bulk orders for 11-50, allowance-gated unlimited USDC approvals, dynamic draw bounds, `MEGAPLANETS_V1`, and canonical `TicketPurchased` receipt decoding | Implemented and unit-tested; real wallet and keeper execution still need an end-to-end rehearsal |
| Planet generator | DOM-free deterministic V3 generator, namespaced randomness, seasonless metadata, 128x128 GIF renderer, web worker, serialization/integrity checks, and regenerated golden fixtures | Complete local checkpoint; final art/economy parameters still require product sign-off |
| Contract V2 | Seasonless ERC721A, sequential token IDs from 1, bidirectional ticket/Planet mappings, atomic batches up to 50, EIP-712 v2 vouchers, live ticket ownership checks, and Foundry unit/fuzz/invariant tests | Deployed to Base Sepolia at `0x7a29...f9f2`; Sourcify exact match; BaseScan verified; runtime activation remains pending |
| Voucher service | Hono endpoint validates the canonical purchase receipt, derives metadata, pins to Pinata, signs EIP-712 vouchers, caches results, and rate-limits/coalesces requests | Standalone Node API process, health/readiness/metrics probes, and local split-stack commands are implemented; production secrets, shared rate limiting, hosting, and ownership are not complete |
| PostgreSQL/indexer | Prisma migrations for tickets, vouchers, Planets, ownership, processed events, cursors, mining ledger, and leaderboard; separate finalized-log runner with adaptive ranges, deployment-scoped idempotency, and bounded ticket/Planet reorg rewinds | Disposable DB rehearsal, 462-ticket backfill, post-mint convergence, repeat idempotency, readiness/metrics probes, and standalone API/indexer processes verified; production reorg-window monitoring remains required |
| Mining | Lazy fixed-point accrual, immutable ledger segments, same-Type multipliers of 0/5/10/15%, per-Planet and wallet snapshots | Transfer sender/receiver repricing, burn state removal, remainder persistence, and same-tx mint ordering are covered by tests; no live transfer/burn performed |
| Leaderboard | Monday-to-Monday periods, deterministic rank/tie rules, live and archived APIs, history, wallet position, frontend, and explicit worker finalization route | Implemented locally; the worker still needs a deployed scheduler and shared database operations owner |
| Frontend | Responsive Play, My Planets list/detail and reveal batches, live mining overlays, leaderboard, wallet integration, deep links, and deterministic GIF previews | Polished local UI; production backend routing, live-wallet flows, and mobile/desktop E2E smoke coverage remain |

## Current frontend behavior

- Primary navigation exposes Play, My Planets, and Leaderboard.
- Home and Tickets routes still exist but are not present in primary navigation.
- LP code remains available but `LP_ENABLED` is false.
- Lab is development-only and is omitted from production navigation.
- My Planets merges canonical eligible Megapot tickets with backend-indexed minted Planets.
- Ticket discovery includes the bounded activation window (`44,996,796..44,997,183`) and
  uses RPC fallbacks for historical receipts, so the original activation tickets do not
  disappear when the Data API or primary RPC is incomplete.
- Unrevealed tickets intentionally hide generated identity and traits until reveal.
- Reveal preflights current ownership in `JackpotTicketNFT`; burned or transferred tickets
  are skipped with an explicit explanation, while every currently-held ticket continues
  through voucher preparation and contract simulation.
- Planet index, mining, leaderboard, and voucher requests share
  `VITE_BACKEND_API_BASE_URL` (with the legacy voucher variable as a compatibility
  fallback), so split frontend/API deployments use one tested base adapter.

## Release blockers and known gaps

### P0 - required before public testnet activation

1. Retain the completed BaseScan verification for the deployed ERC721A V2 and the deployment
   receipt, source match, and constructor arguments as the deployment record.
2. Keep checked-in runtime defaults empty; when the remaining operations gate is approved,
   update frontend, API, indexer, and deployment-block configuration atomically through
   environment-only activation.
3. Deploy PostgreSQL, apply all Prisma migrations, configure the API and a long-running
   indexer, then backfill from the correct V2 deployment block.
4. Expand controlled Base Sepolia rehearsal coverage to direct purchase, keeper bulk
   purchase, batch mint, transfer, mining, same-Type bonus changes, and leaderboard.
5. Keep V2 runtime activation env-only until monitoring, backups, and an explicit
   production operations owner are in place.

### P1 - required before calling indexed scores production-ready

1. Add an automated reconciliation/restore test proving that a full reorg replay rebuilds
   mining accrual state, ledger entries, and leaderboard rows from canonical events.
2. Keep the ticket and Planet block-hash/reorg handling under scheduled monitoring and
   add alerting for lag or repeated reorgs.
3. Deploy and schedule the explicit leaderboard worker/cron; public reads no longer trigger
   overdue-period finalization.
4. Add external indexer lag metrics, structured logs, retry policy, alerting, database
   backups, restore tests, and a rollback runbook; the current readiness/metrics probes
   cover local configuration and process counters only.
5. Use durable distributed voucher rate limiting in production and decide whether voucher
   preparation must require the existing wallet-session authentication flow.
6. Operate the shared backend API-base configuration consistently across frontend services;
   the code-level abstraction and separate-origin tests are complete.

### P2 - cleanup and quality

1. Remove or clearly isolate historical V1 special-edition and daily diversity-snapshot
   modules; they remain in the schema/indexer code but are outside the active MVP.
2. Add Playwright coverage for disconnected, connected, wrong-chain, failed signature,
   receipt failure, reveal, and responsive navigation states.
3. Keep clean-checkout CI coverage healthy: recursive submodules, Prisma generation, and
   Foundry checks are now part of the workflow.
4. Tune the default invariant-test workload. The invariant passes with bounded local runs,
   but the current unbounded/default `forge test` run is impractically slow on this machine.
5. Replace remaining starter-kit branding and issue-template language where appropriate.

## Verification snapshot

The seasonless rewrite and audit-remediation checks completed on 2026-08-12:

- `pnpm db:generate`, `pnpm db:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` pass. The test suite reports 60 files and 238 tests; lint checked 285 files.
  Build output has
  only the existing external PURE-comment and large-chunk warnings.
- Foundry unit, fuzz, and bounded invariant tests pass: 14 tests total, including 256
  fuzz runs per fuzz test and 8 invariant runs at depth 32. `forge build --sizes` reports
  MegaPlanets runtime bytecode at 8,723 bytes and initcode at 10,138 bytes.
- The regenerated ABI contains the seasonless EIP-712 v2 voucher tuple and V2 selectors;
  the active source has no Season model or V1 `SpecialPlanetMinted` path.
- Base Sepolia simulation used chain ID `84532`, deployer/owner/signer
  `0xCfc1044C749fD40E07FE33938414Fa573993F857`, and Jackpot Ticket NFT
  `0x45084829ac63f9dC6a3D4981A46FA896f9180ECd`. At nonce `43`, the predicted deployment
  address is `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`; its preflight code is empty.
  Estimated deployment gas is `2,724,351`, or approximately `0.000029967861 ETH` at the
  simulated gas price. The deployer balance was `0.059719758516987409 ETH`.
- Approved broadcast completed successfully at `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`,
  transaction `0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`,
  block `45,347,860`, with `2,095,655` gas used. Read-only checks confirm code size
  8,723 bytes, the approved owner/signer/ticket NFT, EIP-712 `MegaPlanets / 2`, and
  `totalSupply() = 0` at deployment time. Sourcify verification returned `exact_match`.

Checked-in frontend and backend V2 runtime defaults remain unset. BaseScan verification
completed, and the local runtime rehearsal passed without enabling production defaults.
The rehearsal selected ticket
`369655895285474687617509885184844170268536768125201373131526793984064136106` for the
approved owner and minted it once after preflight: transaction
`0x3607f5f37657457db6d2c3d3c03642e472f01e364468b772b6ec1811d8a21612`, block
`45,353,701`, token ID `16`, owner and metadata verified on-chain, in PostgreSQL, and
through the local API. No transfer or burn was broadcast.

The Stage 7 continuation preflight on 2026-08-12 reconfirmed Base Sepolia chain ID
`84532`, deployed V2 bytecode, owner `0xCfc1044C749fD40E07FE33938414Fa573993F857`,
`totalSupply() = 41`, Megapot drawing `7690`, and a bulk minimum of `3`. The local
HTTP smoke-check returned `200` for the frontend and liveness/metrics routes; readiness
returned the expected `503` while runtime secrets and database configuration were
absent. No live transaction was submitted. A browser visual check remains pending
because this execution environment has no connected browser.

The controlled E2E continuation verified the approved test wallet and active
Megapot drawing read-only. The wallet has `0.059610849887758417` ETH, `17.49` USDC,
and both required USDC allowances at `uint256.max`; direct and three-ticket bulk
purchase simulations succeeded on open drawing `7691`. No write transaction was
submitted because no wallet private key, database, or Pinata runtime secrets are
present in this environment. V2 event reconciliation through finalized block
`45386902` found 41 sequential mints, 41 primary transfers, and zero mapping,
owner, or metadata hash mismatches. Targeted replay, mining-transition, leaderboard,
and runner tests passed. Live purchase/keeper/voucher/batch/transfer/burn scenarios
remain the next gated step once runtime secrets are supplied.

The live E2E gate was re-checked on 2026-08-12. No server or wallet secrets are
available in the execution environment, so no write was attempted. A temporary
non-secret V2 frontend configuration still served the root and liveness/metrics
routes with HTTP `200`; readiness correctly remained `503`. The browser bridge is
unavailable, leaving the remaining live purchase, voucher, batch mint, transfer,
burn, and PostgreSQL replay scenarios gated on external runtime configuration.
