# Current status

Last reviewed: 2026-08-13. This is the current implementation record; it is not a
historical handoff. Start with [`README.md`](../README.md), then use
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`OPERATIONS.md`](./OPERATIONS.md).

## Product checkpoint

The local MVP is complete enough for a five-minute hackathon demo:

- Base Sepolia Megapot direct checkout for 1–10 tickets and keeper bulk checkout for
  11–50 tickets.
- Receipt-verified `MEGAPLANETS_V1` eligibility with durable server-side Megastera Proof.
- Deterministic seasonless Planet generation, signed V2 vouchers, immutable IPFS JSON,
  and bounded VP8 WebM artifacts.
- Free single/batch ERC721A V2 mint flow with live ticket ownership checks.
- Direct ERC721A current holdings by default, with indexed read compatibility fallback.
- Lifetime mining from immutable `baseMineralsPerDay` and `mintedAt`; the current owner
  receives the full lifetime value. No accrual rows, ledger writes, same-type bonus, or
  burn settlement exist in the active runtime.
- Daily UTC leaderboard snapshots finalized by an explicit worker.
- Responsive Play, My Planets, and Leaderboard states with loading, empty, unavailable,
  recovery, and error handling.

## Deployed V2 identity

| Field | Value |
| --- | --- |
| Chain | Base Sepolia (`84532`) |
| Contract | `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` |
| Deployment transaction | `0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c` |
| Deployment block | `45347860` |
| Owner / metadata signer / approved referrer | `0xCfc1044C749fD40E07FE33938414Fa573993F857` |
| Megapot ticket NFT | `0x45084829ac63f9dC6a3D4981A46FA896f9180ECd` |
| Ticket source | `MEGAPLANETS_V1` |
| Activation start / launch gate | `44996796` / `44997183` |

The historical OpenZeppelin V1 deployment is unsupported. Runtime activation remains
environment-only; checked-in frontend and server defaults intentionally do not contain the
V2 address.

## Layer readiness

| Layer | State | Remaining risk |
| --- | --- | --- |
| Contract and ABI | V2 deployed, verified, and covered by Foundry source tests | A live funded deployment gate is still required before public activation. |
| Generator/media | Deterministic traits, legacy GIF regression fixtures, short WebM encoder | Final art/economy sign-off is product work. |
| Voucher/proof API | Receipt finality, Megastera Proof, immutable artifact cache, signer readiness probe | Requires managed PostgreSQL, Pinata, secrets, durable edge limiting, and monitoring. |
| Planet projector | Finalized PlanetMinted/Transfer, block-hash cursor, idempotency, bounded rewind | Requires production backfill/replay/restore rehearsal. |
| Mining | Lifetime formula and direct owner aggregation | No on-chain rewards or payout accounting are in scope. |
| Leaderboard | Daily UTC snapshots and worker finalization | Requires scheduled worker and lag/failure alerts. |
| Frontend | Play → reveal → My Planets → daily leaderboard path | Needs browser/device smoke with a real configured environment. |

## Local verification snapshot

The current source gate is expected to be run from the repository root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
```

Contract verification additionally runs `forge build --sizes`, `forge test`, invariant/fuzz
coverage, and `contracts/script/check-abi.sh`. Record fresh output in the handoff rather
than relying on this document.

## Remaining blockers to public testnet release

These are environment/operations blockers, not reasons to add product complexity:

1. Configure a managed PostgreSQL database, Pinata, Base Sepolia RPC/fallbacks, signer,
   V2 address, deployment block, exact CORS origins, and a durable edge rate limiter.
2. Backfill the finalized projector, run idempotent replay and bounded reorg recovery,
   and verify restore from backup.
3. Schedule daily leaderboard finalization and alert on readiness, indexer lag/failure,
   reorgs, and database errors.
4. Run funded direct/keeper purchases, voucher preparation, batch mint, transfer/burn,
   and leaderboard scenarios from a disposable/approved environment. Never substitute a
   simulation for a required live transaction.
5. Capture a short public demo video, publish the repo/writeup, and submit through the
   hackathon form before the stated deadline.

Mainnet, special editions, on-chain mineral payouts, user accounts, continuous Ticket
indexing, transfer ledgers, and same-type collection bonuses are explicitly out of scope.
