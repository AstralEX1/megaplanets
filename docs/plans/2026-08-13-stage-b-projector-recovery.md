# Stage B — Planet projector recovery

## Goal

Make the finalized Base Sepolia V2 Planet projector rebuild an empty database
without a continuous Ticket indexer. Preserve the existing PostgreSQL cursor,
event identity, and ownership projection architecture.

## Constraints

- Base Sepolia `84532` only.
- Active V2 contract `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`, deployment block `45347860`.
- `MEGAPLANETS_V1` and the canonical Jackpot receipt are purchase provenance.
- Data API and LocalStorage are not authorization sources.
- No contract changes, deployments, paid writes, or secret changes.
- Use TDD and preserve unrelated work.

## Task 1 — Mint-scoped provenance resolver

Add a small API module and focused tests that decode V2 `mint` and `mintBatch`
calldata, map each `PlanetMinted` event to its voucher, resolve the voucher's
`originTxHash` receipt, and return a canonical Megastera Proof. Validate chain,
contract, canonical/finalized receipt, Jackpot event, `MEGAPLANETS_V1`, ticket,
recipient, seed, traits hash, and metadata URI hash. Cache transaction and receipt
reads within a projector cycle. Missing or invalid provenance must throw before
cursor advancement.

## Task 2 — Atomic projection and replay

Integrate the resolver into `api/planetIndexer.ts`. Remove the requirement that a
TicketPurchase already exists. In the existing per-event PostgreSQL transaction,
fully validate or create the TicketPurchase, create the Planet, and write the
processed-event marker. Exact replays are no-ops; immutable conflicts throw.
Preserve `(chainId, contractAddress, transactionHash, logIndex)` and chunk cursor
semantics. Cross-check the initial zero-address Transfer recipient.

## Task 3 — Reorg and concurrent-run safety

Keep the finalized polling architecture. Make rewind restore surviving Planet
owners from the last retained ownership event and ensure stale event payloads are
not silently accepted. Prevent overlapping projector cycles for the same stream
from racing cursor updates without adding Redis, Kafka, or new queues.

## Task 4 — Recovery verification

Run focused red-green tests for empty DB, single/batch mint, missing provenance,
duplicates, crash/restart replay, conflicting immutable payload, transfer, burn,
and boundary-hash rewind. Run replay twice against a disposable PostgreSQL database
when available, compare token count/current owners with Base Sepolia, then run the
fresh repository verification gate.
