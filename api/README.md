# MegaPlanets API

The API is the server-side boundary for receipt-verified Megastera Proofs, immutable
Planet artifacts, V2 vouchers, the finalized Planet projector read model, lifetime mining,
and daily leaderboard snapshots. It never exposes the signer key or other server secrets.
See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for source-of-truth rules and
[`../docs/OPERATIONS.md`](../docs/OPERATIONS.md) for deployment/recovery.

## HTTP surface

- `GET /api/planets/health`
- `GET /api/planets/readiness`
- `GET /api/planets/metrics`
- `GET /api/planets/megastera-proofs?recipient=...&offset=...&limit=...`
- `POST /api/planets/vouchers`
- `POST /api/planets/vouchers/batch`
- `GET /api/planets?owner=...`, `GET /api/planets/:tokenId`
- `GET /api/planets/:tokenId/mining`, `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/current`, `/current/:address`, `/history`,
  `/days/:periodId`
- `POST /api/leaderboard/finalize` with the scheduler-only worker bearer token

`/weeks/:periodId` remains a temporary compatibility alias for clients that have not yet
switched to daily terminology. It is not a weekly period; all periods are UTC calendar
days.

## Local processes

```sh
pnpm api:server
pnpm api:indexer
pnpm api:leaderboard-worker
```

The HTTP server defaults to `127.0.0.1:8787`; set `MEGAPLANETS_API_HOST` and
`MEGAPLANETS_API_PORT` to override. The indexer is not started by the HTTP server. It
projects finalized `PlanetMinted`/`Transfer` events and stores a block-hash cursor under
`megaplanets-v2`. The leaderboard worker is the only daily snapshot mutator.

## Security boundaries

- `MEGAPLANETS_ALLOWED_ORIGINS` is an exact comma-separated CORS allowlist. Empty means
  same-origin only; wildcard and malformed values fail closed.
- JSON request bodies are bounded to 16 KiB.
- Voucher preparation has in-flight coalescing, a local rate limiter, and a local work
  concurrency limit. Production needs a durable edge limiter across replicas.
- The production voucher service requires PostgreSQL; the local JSON store is for one
  process only.
- `MEGAPLANETS_WORKER_TOKEN` protects the leaderboard finalization mutation.

The continuous Ticket indexer is retired. The API persists a Megastera Proof only after
receipt status, canonical block hash, confirmation depth, source tag, recipient, and
ticket event fields have been checked.
