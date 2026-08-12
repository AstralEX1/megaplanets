# Lean MegaPlanets Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove custom ticket/ownership indexing and stateful transfer mining while preserving MegaPlanets purchase, reveal, claim, transfer, burn, history, and leaderboard behavior.

**Architecture:** Base Sepolia is authoritative for current ownership. `MegasteraProof` is the durable server-side proof that a `MEGAPLANETS_V1` purchase receipt produced an eligible ticket. Each Planet carries lifetime production derived from immutable mint time and intrinsic Planet rate; the current owner receives that full value. The leaderboard is rebuilt once per UTC day from current on-chain ownership. NFT media becomes a short WebM instead of GIF.

**Tech Stack:** TypeScript, React, TanStack Query, wagmi, viem, Hono, Prisma/PostgreSQL, Pinata/IPFS, Vitest, Vite, pnpm.

## Global Constraints

- Base Sepolia chain ID is 84532; no contract redeployment or chain write is part of this plan.
- Collection supply is unbounded. Reads must use adaptive chunking and must never truncate silently.
- `MEGAPLANETS_V1` remains the required ticket source.
- `MegasteraProof` is the product term; `TransactionReceipt` remains the Ethereum library type.
- Megapot Data API is discovery/history only. RPC receipt verification and `ownerOf` are authoritative.
- LocalStorage is optimistic cache only and never proves reveal, ownership, wins, or claims.
- Unlimited USDC approval remains allowed; do not request approval when allowance is sufficient.
- Claim, transfer, and burn semantics remain unchanged. Claiming an unrevealed winning Ticket must be guarded because claim burns the Ticket NFT.
- Ticket history initially shows the current and latest 10 rounds, with explicit pagination/load-older controls and no deletion of older history.
- Leaderboard snapshots are produced once per UTC day.
- Source code, tests, technical documentation, filenames, and commits are in English.

---

### Task 1: Megastera Proof and receipt-only ticket persistence

- [ ] Add failing tests for proof normalization, source/recipient/log/finality rejection, idempotent persistence, and old reveal recovery.
- [ ] Introduce `MegasteraProof` and `MegasteraVerifier` around canonical Ethereum receipts.
- [ ] Persist verified proofs server-side and use them for voucher preparation and old reveal candidates.
- [ ] Stop the continuous Ticket indexer and cursor advancement; keep receipt-time persistence.
- [ ] Rename product documentation and internal domain names from canonical receipt to Megastera Proof without renaming viem types.
- [ ] Run focused API/store/indexer tests and commit.

### Task 2: Direct, unbounded Planet ownership reads

- [ ] Add failing tests for zero supply, adaptive chunking, large supply, owner changes, RPC partial failures, and no false-empty result.
- [ ] Discover current holdings from chain state with adaptive `ownerOf` multicalls and block-keyed incremental caching; do not impose a supply cap.
- [ ] Read `tokenURI` and ticket mappings only for owned token IDs and preserve the current UI read model.
- [ ] Make chain ownership authoritative for My Planets and invalidate after mint/transfer.
- [ ] Keep indexed reads only as a temporary explicit rollback mode.
- [ ] Run focused frontend/API tests and commit.

### Task 3: Lifetime Planet mining and daily leaderboard

- [ ] Add failing tests for lifetime production at mint time, transfer moving the full Planet value, burn/removal, deterministic daily snapshots, and UTC boundary handling.
- [ ] Define Planet value as intrinsic `mineralRate * elapsed time since mintedAt`; current ownership determines who receives the entire value.
- [ ] Remove transfer-period accrual, mineral ledger, ownership-history, and same-wallet repricing from runtime reads.
- [ ] Build current wallet mining totals directly from owned Planet immutable traits and mint timestamps.
- [ ] Rebuild and persist one leaderboard snapshot per UTC day; serve the latest completed snapshot and its `asOf` timestamp.
- [ ] Add a forward Prisma migration only after dual-read/backfill tests prove replacement parity at the chosen cutover block.
- [ ] Run mining, leaderboard, Prisma, and API tests and commit.

### Task 4: Ticket history/UI separation and lifecycle correctness

- [ ] Add failing tests for current/latest-10 default history, load older pagination, Data API partial errors, optimistic cache precedence, and old reveal through Megastera Proof.
- [ ] Keep Tickets UI history on Megapot Data API with explicit pagination; never scan the complete history automatically.
- [ ] Keep reveal candidates separate and backed by server-side Megastera Proof plus RPC owner verification.
- [ ] Centralize query invalidation after direct purchase, bulk execution, mint, and claim.
- [ ] Guard claim-before-reveal while preserving direct claim, transferred ticket rejection, and burned ticket handling.
- [ ] Run hook/page tests and commit.

### Task 5: Short WebM artifacts and batch vouchers

- [ ] Add failing media fixture tests for deterministic playable WebM output, MIME type, bounded duration/size, and immutable artifact reuse.
- [ ] Replace GIF generation/upload with short WebM generation and `video/webm` metadata media.
- [ ] Separate immutable media/metadata artifacts from expiring EIP-712 signatures so retries never re-render or re-pin.
- [ ] Add an ordered, idempotent batch voucher endpoint for 1-50 proof references while retaining the singular compatibility wrapper.
- [ ] Bound media workers and queue length; return structured 409/422/429/503 errors.
- [ ] Update golden fixtures intentionally and run generator/API/browser media tests before commit.

### Task 6: Remove unused infrastructure and dead product surfaces

- [ ] Add route/import/schema characterization tests before deletion.
- [ ] Remove LP, subscription, referral-claim UI, dead visual components/assets, and dependencies with no remaining imports.
- [ ] Remove backend nonce/session auth routes and Prisma models only after proving no live frontend/API consumer remains.
- [ ] Preserve RainbowKit/wagmi wallet connection and purchase referral configuration.
- [ ] Make production API fail closed without PostgreSQL and verify the configured signer against `metadataSigner()` in readiness.
- [ ] Update architecture, status, runbook, environment, and root README documentation.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm db:validate`; commit.

### Task 7: Final reconciliation and rollout

- [ ] Compare chain holdings, Megastera Proof rows, lifetime mining totals, and daily leaderboard with the legacy database at a fixed finalized block.
- [ ] Exercise direct purchase, keeper purchase, old reveal, batch reveal, mint, transfer, claim/burn, and daily leaderboard on Base Sepolia.
- [ ] Disable legacy read paths behind rollback flags before dropping any tables.
- [ ] Perform migration backup/restore rehearsal and document rollback commands.
- [ ] Complete whole-branch review, fresh full verification, documentation check, and final commit.
