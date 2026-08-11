# Delivery Roadmap

Each stage ends with a user-visible checkpoint. Work must not continue into the next stage
until the user explicitly requests it.

Status as of 2026-08-11: Stages 1-6 have substantial implementations, the seasonless
ERC721A V2 is deployed on Base Sepolia, and the first ticket-to-Planet mint has completed
with PostgreSQL/indexer convergence. Historical V1 deployments are no longer supported.
The remaining work is controlled testnet coverage and production operations; the detailed
gaps are in [`STATUS.md`](./STATUS.md).

## Stage 1 — Repository foundation and ERC-721A V2

**Status: implemented and deployed.** Contract source, ABI, unit, fuzz, and invariant
coverage exist; the seasonless V2 deployment is recorded on Base Sepolia.

Audit the starter-kit baseline, define the simplified game loop, and prepare the clean,
non-upgradeable ERC-721A V2 contract. Pin contract dependencies, regenerate the ABI, and
validate individual and batch ticket-backed mints locally. Do not deploy from this stage.

Checkpoint: architecture documents, contract code, ABI, and Foundry tests prove sequential
Planet IDs, atomic batch minting, and ticket-to-Planet provenance mappings.

## Stage 2 — Direct and bulk Megapot purchase provenance

**Status: implemented and unit-tested.** A controlled direct and keeper-executed live
rehearsal is still required.

Target Base Sepolia with two purchase paths: one to ten immediate manual or client
quick-pick tickets through `Jackpot.buyTickets`, and 11 to 50 all-random tickets through
`BatchPurchaseFacilitator`. Every bulk order passes its full quantity as
`dynamicTicketCount` with an empty static-ticket array. Read dynamic bounds, ticket price,
and bulk minimum dynamically; approve the exact amount to the contract that pulls USDC.

Decode every canonical `TicketPurchased` event and persist ticket ID, drawing ID, numbers,
origin transaction hash, and log index. For bulk orders, provenance comes from each keeper
execution transaction, never the initial order-creation transaction.

Checkpoint: confirmed immediate and keeper-executed purchases have independently
reproducible provenance for every emitted ticket.

## Stage 3 — Deterministic Planet generator

**Status: implemented with regenerated golden fixtures.** Final art/economy sign-off remains.

Implement the canonical generator with the V3 ABI seed, configurable Types, deterministic
names, minerals/rarity, GIF previews, and golden vectors.

Checkpoint: metadata and GIF outputs are reproducible from canonical ticket provenance.

## Stage 4 — Metadata, eligibility, and ERC-721A V2 integration

**Status: implemented with a completed single-mint rehearsal.** The voucher, Prisma,
finalized indexer, and frontend paths have passed a real V2 ticket-to-IPFS-to-mint flow;
batch-mint and broader purchase coverage remain controlled follow-ups.

Index eligible source events for the original purchase recipient, generate and pin
canonical metadata, issue replay-protected mint vouchers, and index the V2 `PlanetMinted`
and ERC-721A `Transfer` events. Update frontend configuration and claimed/revealed state to
use Planet token IDs and the ticket provenance mapping.

Checkpoint: a local ticket-to-IPFS-to-voucher-to-V2-Planet flow works against an isolated
test environment and remains idempotent after indexer replay.

## Stage 5 — Mining and same-Type bonuses

**Status: implemented and regression-tested.** Sender/receiver repricing, burn removal,
fixed-point remainder persistence, and reorg-safe cursor/reset behavior are covered by
focused tests. A live transfer/burn rehearsal remains intentionally pending.

Add lazy fixed-point mineral accrual, an immutable mineral ledger, and same-Type
production-bonus calculation. Settle production at transfer and bonus-change
boundaries rather than using daily accrual jobs.

Checkpoint: mineral totals are reproducible and transfers split production at the correct
timestamp.

## Stage 6 — Weekly leaderboard

**Status: implemented locally and exercised through the rehearsal API.** Production
scheduling, monitoring, and independent period finalization remain.

Add Monday-to-Monday UTC periods, current and historical ranks, distance to the next rank,
and reproducible finalization. Include active production through the period cutoff.

Checkpoint: a complete local leaderboard rehearsal can be reconstructed from ledger and
rate-segment data.

## Stage 7 — Base Sepolia deployment and end-to-end test

**Status: in progress.** ERC721A V2 deployment, verification, one authorized mint,
metadata publication, six confirmations, indexer convergence, and idempotent replay have
passed. Direct/keeper purchase, batch mint, transfer/burn, mining transition, and
leaderboard scenarios still need controlled coverage.

Keep checked-in runtime defaults empty. Use the recorded V2 address and deployment block
through environment-only activation for controlled Base Sepolia runs, then validate
minting, transfers, mining, and leaderboard indexing from receipts and events.

Checkpoint: real individual and batch Planet mints have IPFS metadata, Basescan links, and
correct indexed gameplay state.

## Stage 8 — Testnet operations and public MVP release

**Status: next stage.** The repository now contains a separate finalized indexer process,
health/readiness probes, an operations runbook, and a disposable PostgreSQL rehearsal.

Next, deploy the API, indexer, PostgreSQL, and frontend as separate testnet services;
configure managed RPC and secret storage; add lag/alert monitoring, backups/restore,
scheduled leaderboard finalization, and Playwright user-flow smoke coverage. Complete the
remaining controlled purchase, batch, transfer/burn, and leaderboard rehearsals before a
public testnet announcement. Mainnet remains a separate approval-gated decision.
