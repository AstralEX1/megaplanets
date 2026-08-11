# Development Status

Last audited: 2026-08-11 at commit `e0e0e1a` (`main`).

This document is the current implementation snapshot. Product intent remains in
[`PRODUCT_SPEC.md`](./PRODUCT_SPEC.md), architectural boundaries remain in
[`ARCHITECTURE.md`](./ARCHITECTURE.md), and future work is ordered in
[`ROADMAP.md`](./ROADMAP.md).

## Executive summary

MegaPlanets has a substantial local MVP implementation: Megapot ticket purchases,
canonical receipt provenance, deterministic Planet generation, individual and batch
voucher mint flows, a PostgreSQL indexer, lazy mining, same-Type bonuses, weekly
leaderboards, and the corresponding frontend surfaces all exist and are covered by unit
tests.

It is not yet a releasable end-to-end testnet product. Historical V1 deployments are no
longer part of the active product and the repository intentionally has no default
MegaPlanets contract address. The checked-in contract, ABI, database model, and current
product specification target an undeployed ERC721A V2. The API, database, and indexer also
have no checked-in production deployment configuration or recorded successful chain
rehearsal.

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

## Layer-by-layer state

| Layer | Implemented now | Readiness |
| --- | --- | --- |
| Megapot purchases | Direct 1-10 custom/quick-pick purchases, all-random keeper bulk orders for 11-50, exact USDC approvals, dynamic draw bounds, `MEGAPLANETS_V1`, and canonical `TicketPurchased` receipt decoding | Implemented and unit-tested; real wallet and keeper execution still need an end-to-end rehearsal |
| Planet generator | DOM-free deterministic Season 1 generator, namespaced randomness, metadata, 128x128 GIF renderer, web worker, serialization/integrity checks, and golden fixtures | Complete local checkpoint; final art/economy parameters still require product sign-off |
| Contract V2 | ERC721A, sequential token IDs from 1, bidirectional ticket/Planet mappings, atomic batches up to 50, EIP-712 vouchers, live ticket ownership checks, and Foundry unit/fuzz/invariant tests | Local checkpoint only; the known `0xa94b...d744` deployment is V1, and no V2 address or deployment block is recorded |
| Voucher service | Hono endpoint validates the canonical purchase receipt, derives metadata, pins to Pinata, signs EIP-712 vouchers, caches results, and rate-limits/coalesces requests | Suitable for local/single-process use; production secrets, shared rate limiting, wallet authentication policy, and hosting are not complete |
| PostgreSQL/indexer | Prisma migrations for tickets, vouchers, Planets, ownership, processed events, cursors, mining ledger, and leaderboard; separate finalized-log runner with bounded ranges and Planet-stream reorg detection | Implemented locally; no production database/backfill evidence, no indexer health endpoint, and rollback coverage is incomplete |
| Mining | Lazy fixed-point accrual, immutable ledger segments, same-Type multipliers of 0/5/10/15%, per-Planet and wallet snapshots | Core calculations are tested; transfer/burn bonus recomputation and reorg rollback need correction before scores are authoritative |
| Leaderboard | Monday-to-Monday periods, deterministic rank/tie rules, live and archived APIs, history, wallet position, and frontend | Implemented locally; finalization is triggered by leaderboard requests rather than an independent operations job |
| Frontend | Responsive Play, My Planets list/detail and reveal batches, live mining overlays, leaderboard, wallet integration, deep links, and deterministic GIF previews | Polished local UI; production backend routing, live-wallet flows, and mobile/desktop E2E smoke coverage remain |

## Current frontend behavior

- Primary navigation exposes Play, My Planets, and Leaderboard.
- Home and Tickets routes still exist but are not present in primary navigation.
- LP code remains available but `LP_ENABLED` is false.
- Lab is development-only and is omitted from production navigation.
- My Planets merges canonical eligible Megapot tickets with backend-indexed minted Planets.
- Unrevealed tickets intentionally hide generated identity and traits until reveal.
- The frontend uses relative same-origin routes for Planet index, mining, and leaderboard
  reads. Only voucher requests honor `VITE_PLANET_API_BASE_URL`, so a split frontend/API
  deployment needs an explicit proxy or a shared API-base abstraction.

## Release blockers and known gaps

### P0 - required before another public testnet mint

1. Deploy and verify the ERC721A V2 after explicit approval, then record its address,
   deployment block, owner, metadata signer, Season ID, bytecode/ABI match, and transaction.
2. Keep the active contract address unset until the V2 deployment gate passes, then update
   frontend, API, indexer, and deployment-block configuration atomically.
3. Deploy PostgreSQL, apply all Prisma migrations, configure the API and a long-running
   indexer, then backfill from the correct V2 deployment block.
4. Run a controlled Base Sepolia rehearsal covering direct purchase, keeper bulk purchase,
   single mint, batch mint, transfer, mining, same-Type bonus changes, and leaderboard.
5. Correct mining transitions so the sender's remaining Planets are recomputed after a
   transfer or burn. Add regression tests for both sender and receiver bonus boundaries.

### P1 - required before calling indexed scores production-ready

1. Make reorg rollback restore or deterministically rebuild mining accrual state and ledger
   entries. The current Planet rewind removes chain rows but does not rewind mining rows.
2. Add block-hash/reorg handling to the Megapot ticket indexer, not only the Planet indexer.
3. Move weekly finalization to an explicit worker/cron instead of relying on a public read
   request to discover overdue periods.
4. Add indexer lag/readiness endpoints, structured logs, retry policy, alerting, database
   backups, restore tests, and a rollback runbook.
5. Use durable distributed voucher rate limiting in production and decide whether voucher
   preparation must require the existing wallet-session authentication flow.
6. Unify backend URL handling for voucher, Planet index, mining, and leaderboard requests.

### P2 - cleanup and quality

1. Remove or clearly isolate historical V1 special-edition and daily diversity-snapshot
   modules; they remain in the schema/indexer code but are outside the active MVP.
2. Add Playwright coverage for disconnected, connected, wrong-chain, failed signature,
   receipt failure, reveal, and responsive navigation states.
3. Fix clean-checkout automation: CI must generate Prisma Client before typecheck/tests and
   should initialize submodules and run Foundry checks.
4. Tune the default invariant-test workload. The invariant passes with bounded local runs,
   but the current unbounded/default `forge test` run is impractically slow on this machine.
5. Replace remaining starter-kit branding and issue-template language where appropriate.

## Verification snapshot

The audited checkout passes after `pnpm db:generate`:

```text
pnpm lint       passed
pnpm typecheck  passed
pnpm test       passed: 48 files, 191 tests
pnpm build      passed (with a large-chunk warning)
pnpm db:validate passed
```

Foundry results:

```text
10 unit tests passed
2 fuzz tests passed, 256 runs each
1 invariant passed with FOUNDRY_INVARIANT_RUNS=8 and FOUNDRY_INVARIANT_DEPTH=32
```

This verification proves deterministic local behavior. It does not prove the production
API, database, Pinata, signer, live wallet, or Base Sepolia end-to-end path.
