# Roadmap and next work

This roadmap describes the current lean architecture. It is ordered by demo/release
value, not by the historical implementation stages. Do not reintroduce superseded
accrual, ledger, same-type, weekly, continuous-ticket-indexer, or application-auth work.

## Now — hackathon submission

- Keep the five-minute path obvious: connect → buy Megapot tickets → confirm the
  Megastera Proof → mint a Planet → inspect lifetime mining → open the daily leaderboard.
- Record a clean demo environment and a short video showing one direct purchase/reveal;
  use a previously indexed Planet for the mining/leaderboard segment when live funding is
  unavailable.
- Publish the public repository, architecture/writeup, and the official submission form.
- Verify the exact Base Sepolia V2 identity and keep checked-in runtime addresses empty.

## Before public testnet release

1. Deploy API and finalized Planet projector separately with managed PostgreSQL, Pinata,
   RPC fallbacks, secret storage, and exact `MEGAPLANETS_ALLOWED_ORIGINS`.
2. Backfill from the V2 deployment block, compare the database to finalized
   `PlanetMinted`/`Transfer` events, and run replay twice to prove idempotency.
3. Test a bounded recent reorg rewind, restore from backup, and verify cursor block hashes.
4. Schedule the daily leaderboard worker and alert on readiness, indexer failures/lag,
   reorgs, database errors, and stale finalization.
5. Run funded direct, keeper bulk, voucher, batch mint, transfer, burn, and claim flows
   with explicit approval and a disposable database.
6. Add a focused browser smoke suite once a safe wallet/test-fixture strategy exists.

## Later, only with explicit product approval

- Base mainnet activation.
- On-chain mineral payouts or a separately designed rewards economy.
- Special editions or non-ticket Planet sources.
- Additional social/retention mechanics that do not make ownership or mining ambiguous.

## Explicitly rejected for the current MVP

- Per-second or daily mineral writes.
- Transfer-period accrual settlement and ownership-history mining ledgers.
- Same-type or diversity repricing.
- Continuous indexing of every Megapot Ticket event.
- Browser-trusted metadata, mutable media, or backend user-auth accounts.
