# Delivery Roadmap

Each stage ends with a user-visible checkpoint. Work must not continue into the next stage
until the user explicitly requests it.

Status as of 2026-08-11: Stages 1-6 have substantial local implementations, but they are
not release-complete. Historical V1 deployments are no longer supported, ERC721A V2
remains undeployed, and backend/indexer/mining operations still have release blockers. The
detailed audit and prioritized gaps are in [`STATUS.md`](./STATUS.md).

## Stage 1 — Repository foundation and ERC-721A V2

**Status: local checkpoint implemented.** Contract source, ABI, unit, fuzz, and invariant
coverage exist. V2 has not been deployed.

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

**Status: implemented locally, blocked on V2 deployment and production services.** The
voucher, Prisma, indexer, and frontend paths exist but have not completed a real V2
ticket-to-IPFS-to-mint rehearsal.

Index eligible source events for the original purchase recipient, generate and pin
canonical metadata, issue replay-protected mint vouchers, and index the V2 `PlanetMinted`
and ERC-721A `Transfer` events. Update frontend configuration and claimed/revealed state to
use Planet token IDs and the ticket provenance mapping.

Checkpoint: a local ticket-to-IPFS-to-voucher-to-V2-Planet flow works against an isolated
test environment and remains idempotent after indexer replay.

## Stage 5 — Mining and same-Type bonuses

**Status: implemented locally with a correctness gap.** Sender-side bonus recomputation
after transfer/burn and mining-aware reorg rollback must be fixed and tested.

Add lazy fixed-point mineral accrual, an immutable mineral ledger, and same-Type
production-bonus calculation. Settle production at transfer and bonus-change
boundaries rather than using daily accrual jobs.

Checkpoint: mineral totals are reproducible and transfers split production at the correct
timestamp.

## Stage 6 — Weekly leaderboard

**Status: implemented locally.** Production scheduling, monitoring, database rehearsal,
and independent period finalization remain.

Add Monday-to-Monday UTC periods, current and historical ranks, distance to the next rank,
and reproducible finalization. Include active production through the period cutoff.

Checkpoint: a complete local leaderboard rehearsal can be reconstructed from ledger and
rate-segment data.

## Stage 7 — Base Sepolia deployment and end-to-end test

**Status: pending.** No active contract address is configured; this stage starts with the
explicitly approved ERC721A V2 deployment gate.

Only with explicit deployment approval: deploy and verify ERC-721A V2, update the
configuration with the verified address and deployment block, then run real Sepolia
ticket-to-Planet transactions. Validate minting, transfers, mining, and leaderboard
indexing from receipts and events.

Checkpoint: real individual and batch Planet mints have IPFS metadata, Basescan links, and
correct indexed gameplay state.

## Stage 8 — Public MVP release

**Status: pending.** No production release or operational readiness evidence is recorded.

Deploy the approved frontend and backend infrastructure, publish CI and runbooks, complete
mobile and desktop smoke tests, and prepare public demo materials. Mainnet remains a
separate approval-gated decision.
