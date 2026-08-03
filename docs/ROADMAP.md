# Delivery Roadmap

Each stage ends with a user-visible checkpoint. Work must not continue into the next stage until the user explicitly requests it.

## Stage 1 — Repository foundation

Import the starter kit, install project guidance and the Megapot skill, configure Base documentation access, create subsystem boundaries, and verify the clean build.

## Stage 2 — Batch Megapot purchase and provenance

Target Base Sepolia and support one to ten manual or quick-pick tickets per purchase. Read dynamic ticket bounds and price, approve the exact batch USDC amount, and preserve source/referrer attribution. Decode every canonical `TicketPurchased` event in the receipt and persist each ticket ID, drawing ID, numbers, origin transaction hash, and log index.

Checkpoint: a confirmed batch purchase has independently reproducible ticket provenance for every emitted ticket.

## Stage 3 — Deterministic Planet generator

Implement the canonical generator with the Season 1 seed, ten configurable Types, weighted bonus-ball Type profiles, deterministic names, hierarchical minerals/rarity, GIF previews, and golden vectors.

Checkpoint: metadata and GIF outputs are reproducible from canonical ticket provenance.

## Stage 4 — Planet NFT contract

Implement and test the non-upgradeable ERC-721. Support free individual and batch mints authorized by EIP-712 vouchers, verify live ticket ownership, reject claimed/burned and duplicate tickets, store immutable metadata CIDs, and reserve owner-only manual 1/1 mints.

Checkpoint: Foundry unit/fuzz tests demonstrate individual mint, batch mint, ownership transfer before mint, claimed-ticket rejection, and special-edition minting.

## Stage 5 — Metadata, eligibility, and snapshot backend

Index eligible source events, verify ticket ownership, generate and pin canonical metadata, issue replay-protected mint vouchers, snapshot all Planet holders daily, read immutable token metadata, and calculate auditable collection scores and referral allocations.

Checkpoint: local ticket-to-IPFS-to-voucher pipeline and reproducible snapshot report.

## Stage 6 — Base Sepolia Planet mint

Deploy and verify the contract, connect individual/batch voucher minting, show eligibility and immutable Planet traits, and complete real Sepolia ticket-to-Planet transactions.

Checkpoint: real individual and batch Planet mints with IPFS metadata and Basescan links.

## Stage 7 — Season gameplay and leaderboard

Finish collection progress, trading links, live leaderboard, daily snapshots, weekly finalization, referral payout report, and manual 1/1 prize distribution workflow.

Checkpoint: a complete reproducible Season 1 scoring and reward-distribution rehearsal.

## Stage 8 — Public MVP release

Deploy Vercel and Supabase infrastructure, publish CI and documentation, run mobile and desktop smoke tests, and prepare the public demo and submission materials.
