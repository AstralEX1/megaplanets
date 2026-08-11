# API

This directory contains the current server-side boundary:

- strict server-only environment validation;
- decoding of canonical `MEGAPLANETS_V1` purchase logs;
- deterministic metadata/GIF preparation and Pinata upload helpers;
- EIP-712 mint-voucher signing helpers; and
- a rate-limited voucher endpoint with in-flight request coalescing;
- local JSON and PostgreSQL eligibility/voucher stores;
- wallet-session authentication and indexed Planet read APIs;
- lazy mineral accrual, same-Type bonuses, and weekly leaderboard APIs; and
- a bounded, confirmation-aware ticket/Planet indexer runner that is started separately.

## HTTP surface

- `GET /api/planets/health`
- `POST /api/planets/vouchers`
- `POST /api/auth/nonce`, `POST /api/auth/verify`, `POST /api/auth/logout`
- `GET /api/me`, `GET /api/me/planets`, `GET /api/me/mining`
- `GET /api/planets?owner=...`, `GET /api/planets/:tokenId`
- `GET /api/planets/:tokenId/mining`, `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/current`, `/current/:address`, `/history`, and
  `/weeks/:periodId`

`api/planetIndexerMain.ts` is the separate long-running indexer entry point. The HTTP
server does not start it. Leaderboard finalization currently runs lazily from leaderboard
read routes; production should move this responsibility to an explicit operations job.

## Production limitations

The file store is appropriate only for one local process. Production requires PostgreSQL,
durable edge rate limiting, secret storage, operational scheduling, monitoring, backups,
and restore/rollback procedures. Ticket vouchers remain bound to the original
`TicketPurchased` recipient, while the contract independently checks current live ticket
ownership.

The Planet indexer has bounded reorg detection, but its rewind does not yet rebuild mining
ledger/accrual state. The ticket indexer relies on confirmation depth and does not yet keep
a block-hash rewind cursor. These gaps must be closed before indexed mining scores are
authoritative. Never expose the metadata signer private key to browser code.
