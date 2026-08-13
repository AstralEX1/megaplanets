# MegaPlanets architecture

This is the authoritative system map for the current seasonless ERC721A V2 MVP.
Start with [`README.md`](../README.md) for the product loop, then read
[`AGENTS.md`](../AGENTS.md) before editing. [`STATUS.md`](./STATUS.md) records what is
actually ready; [`OPERATIONS.md`](./OPERATIONS.md) is the deployment and recovery
runbook. Older implementation plans are historical and are not instructions.

## Authoritative sources

| Concern | Source of truth | What the other layers may do |
| --- | --- | --- |
| Ticket purchase and drawing state | Megapot contracts and Base Sepolia RPC | The Data API is discovery/history only. |
| Ticket eligibility | Confirmed receipt containing the canonical `MEGAPLANETS_V1` event, validated by `MegasteraVerifier` | Server stores a durable Megastera Proof after receipt finality. |
| Planet identity and mint validity | `contracts/src/MegaPlanets.sol` plus the deployed V2 bytecode/ABI | API signs constrained vouchers; frontend previews only. |
| Current Planet holdings | ERC721A `ownerOf`/`balanceOf`/`tokenOfOwnerByIndex` through direct RPC | The PostgreSQL projector is a fallback/read model and operational index. |
| Mint time and indexed traits | Finalized `PlanetMinted` plus initial `Transfer` events | Projector retries idempotently and rewinds on block-hash mismatch. |
| Lifetime minerals | `baseMineralsPerDay × elapsed since mintedAt` in `api/mining.ts` | API and frontend interpolate display-only values between snapshots. |
| Leaderboard | PostgreSQL `LeaderboardPeriod`/`LeaderboardEntry` daily UTC snapshots | A worker finalizes completed days; public routes are read-only. |
| Canonical media | Immutable `PlanetArtifact` with IPFS JSON and bounded VP8 WebM CIDs/hashes | Checked-in GIFs are regression fixtures only. |

## Product flow

```text
Megapot ticket purchase
  → confirmed receipt and Megastera Proof
  → deterministic generator input
  → immutable IPFS artifact and EIP-712 voucher
  → free MegaPlanets mint
  → direct current ownership
  → lifetime minerals
  → daily UTC leaderboard snapshot
```

Direct purchases use one to ten tickets. Eleven to fifty all-random tickets use the
keeper facilitator; each execution receipt, not the order-creation receipt, is the
provenance source. Every route reads ticket price, drawing ID, ball limits, and bulk
minimum dynamically. USDC approvals compare the exact required allowance and approve the
route-specific spender with `maxUint256` only when insufficient; a successful receipt
invalidates/refetches allowance state.

The source tag is always `MEGAPLANETS_V1`. This is Megapot attribution and is unrelated
to the unsupported historical MegaPlanets V1 NFT deployment.

## Frontend boundaries

`src/pages/Play.tsx` owns checkout/reveal orchestration. It uses direct RPC receipt
recovery, server Megastera Proofs, and bounded chain windows only while an expedition is
active or a resumable session exists. The idle form does not start the expensive
four-source recovery query. Bulk facilitator reads/watchers are similarly disabled for
ordinary one-to-ten direct purchases.

`src/hooks/useIndexedPlanets.ts` reads current holdings directly from the V2 contract by
default. `VITE_PLANET_HOLDINGS_SOURCE=indexed` is an explicit compatibility rollback, not
the normal path. The frontend never treats an indexed row or a Data API row as proof that
a ticket can mint.

`src/hooks/useWalletMining.ts` consumes the public lifetime snapshot. The UI may render a
live interpolated number, but it never writes mineral state and never displays a
same-type multiplier, pending accrual, or transfer settlement.

## API and persistence

The Hono app in `api/index.ts` exposes health/readiness/metrics, Megastera Proofs,
voucher/artifact preparation, indexed Planet compatibility reads, mining, and leaderboard
routes. Server secrets are loaded only from server environment variables. JSON bodies are
bounded to 16 KiB; voucher work has a process-local concurrency guard and rate limiter.
Production still needs a durable edge limiter across replicas.

Split frontend/API deployments must set the exact comma-separated
`MEGAPLANETS_ALLOWED_ORIGINS` allowlist. Empty means same-origin only; wildcard, paths,
credentials, and malformed origins are rejected. The API never enables credentialed CORS.

PostgreSQL is the production store. The local JSON store is useful for one local process
and is rejected for production voucher service startup. Current forward runtime tables are
ticket proofs, immutable artifacts, vouchers, Planets, projector cursors/events,
ownership read models, and daily leaderboard periods/entries. Historical Prisma models and
migrations may remain for database compatibility, but no current code writes accrual
ledgers, transfer settlements, same-type state, continuous Ticket-indexer state, or
application user-auth records.

## Finalized Planet projector

`api/planetIndexer.ts` and `api/planetIndexerWorker.ts` project only the deployed V2
`PlanetMinted` and ERC721A `Transfer` stream. The cursor stores `nextBlock` and the last
finalized block hash under `megaplanets-v2`. The worker:

1. chooses a finalized range;
2. compares the stored boundary hash with the chain;
3. replays from the V2 deployment block on boundary mismatch rather than assuming
   the divergence is contained inside a fixed window;
4. decodes and validates events;
5. writes mint/owner state and processed-event idempotency records; and
6. advances the cursor only after the range is complete.

`PlanetMinted` creates the Planet with zero owner; the same transaction's initial Transfer
sets the recipient. Later transfers update only `ownerAddress`. The zero address is not a
mining owner. A burn therefore removes a Planet from current-owner reads and leaderboard
rows; it does not create an accrual settlement.

The legacy Megapot Ticket indexer is retired. Server-side Megastera Proofs are written
only when the receipt verifier has checked the canonical event and confirmation depth.

## Contracts and deployment identity

The active contract is Base Sepolia chain `84532`:

- V2 address: `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`
- deployment transaction: `0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`
- deployment block: `45347860`
- deployment owner, signer, and approved referrer: `0xCfc1044C749fD40E07FE33938414Fa573993F857`
- Megapot ticket NFT: `0x45084829ac63f9dC6a3D4981A46FA896f9180ECd`

Checked-in runtime addresses remain empty until the operations gate is approved. The
historical OpenZeppelin V1 address is unsupported and must never be configured as V2.
Keep launch block `44997183`, activation start `44996796`, and `TICKET_SOURCE` unchanged.

## Verification map

Use the exact commands in [`OPERATIONS.md`](./OPERATIONS.md). The minimum application gate
is `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:generate`, and
`pnpm db:validate`. Contract changes additionally require Foundry build/tests and the
checked-in ABI check. Browser smoke is evidence only when a real browser/dev-server path
is available; it must cover Play, My Planets, and Leaderboard loading/empty/error states.
