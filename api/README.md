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

## V2 deployment closure and runtime gate

The active seasonless ERC721A V2 deployment record is Base Sepolia contract
`0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`, transaction
`0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`, block
`45,347,860`, with Sourcify `exact_match`. The exact script commands are:

- `cd contracts && ./script/deploy-v2-approved.sh`
- `cd contracts && BASESCAN_API_KEY=... ./script/verify-v2-basescan.sh`

The verification script must only run when the current session already provides
`BASESCAN_API_KEY`; otherwise it exits without attempting a network verification.

BaseScan remains pending in any session that does not already provide
`BASESCAN_API_KEY`, and BaseScan verification by itself does not authorize runtime
activation.

The API must continue to fail closed by default. Do not add checked-in runtime defaults
for V2 activation. Only after the full rehearsal gate passes may runtime env activate V2
by setting the frontend env `VITE_MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`
and the backend envs
`MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` plus
`MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860` together, while keeping
`MEGAPLANETS_LAUNCH_BLOCK=44997183` and `TICKET_SOURCE=MEGAPLANETS_V1` unchanged.

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
