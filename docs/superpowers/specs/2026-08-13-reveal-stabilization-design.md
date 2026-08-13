# Reveal Stabilization Design

## Goal

Make receipt discovery, voucher preparation, and single/batch Planet reveal reliable for old and newly purchased Base Sepolia tickets without changing the deployed contract or adding a continuous Ticket indexer.

This is a one-day hackathon stabilization pass. The release-critical path is exact
execution-ticket selection, wallet isolation, fail-closed server authority checks,
artifact revalidation, and duplicate-submission protection. A richer partial-result
batch protocol and exhaustive UI state taxonomy are explicitly deferred.

## Boundaries

- Megapot receipts and Base Sepolia RPC remain the eligibility authority.
- The Data API discovers history only; LocalStorage is optimistic recovery state only.
- The API must revalidate canonical finality, `MEGAPLANETS_V1`, recipient, live ticket ownership, and the absence of an existing Planet before signing.
- The deployed V2 batch limit remains 50. Larger reveal sets are executed as successive client-side chunks.
- Invalid, transferred, burned, claimed, duplicate, or already minted tickets are reported and excluded. An unreadable authority check fails closed and does not silently skip.
- Existing immutable IPFS artifacts are reused only after their seed, traits, recipient, ticket, and URI hashes match the canonical proof. Expired signatures are regenerated over the same artifact.

## Design

The backend exposes a small typed error boundary with a safe stage code and request ID. Receipt lookup, canonical block lookup, and live contract reads share bounded RPC fallback behavior. Voucher preparation stays idempotent through the existing proof/artifact/voucher stores; the server validates an existing artifact before reuse. Cross-replica pin-once coordination is deferred because it requires infrastructure beyond the one-day MVP gate.

The frontend preserves the exact `TicketPurchased` references recovered from each direct or keeper execution receipt. It deduplicates by ticket ID and receipt position, checks current ownership, removes unavailable tickets with a visible reason, and submits only a valid group of at most 50. After a confirmed mint it invalidates all ticket, ownership, Planet, and mining queries; if more valid tickets remain, the next group is offered without recreating the purchase session.

## Error model

Expected singular voucher failures use a small stable stage/code pair plus a request ID. Responses contain a user-safe message, never secrets or raw provider payloads. The batch endpoint keeps its existing atomic compatibility behavior for the hackathon MVP; ordered per-item partial results are deferred.

## Verification

TDD covers exact bulk execution provenance, duplicate inputs, 1/50/51+ grouping, partial invalid tickets, ownership read outage, claimed/burned/transferred/already-minted tickets, expired voucher regeneration, artifact conflict, concurrent pin-once behavior, canonical/finality fallback, cache invalidation, wallet rejection, revert, and account/network isolation. The stage ends with the full repository gate and read-only Base Sepolia simulations; no funded write is required unless a gap cannot be proven otherwise.
