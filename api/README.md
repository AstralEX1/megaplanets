# API

This directory contains the current server-side boundary:

- strict server-only environment validation;
- decoding of canonical `MEGAPLANETS_V1` purchase logs;
- deterministic metadata/WebM preparation and Pinata upload helpers;
- EIP-712 mint-voucher signing helpers; and
- a rate-limited voucher endpoint with in-flight request coalescing;
- local JSON and PostgreSQL eligibility/voucher stores;
- direct frontend Planet ownership plus compatibility Planet read APIs;
- lifetime mineral reads and daily leaderboard snapshot APIs; and
- a bounded, confirmation-aware Planet-only projector started separately.

## HTTP surface

- `GET /api/planets/health`
- `GET /api/planets/readiness`
- `GET /api/planets/metrics`
- `POST /api/planets/vouchers`
- `POST /api/planets/vouchers/batch`
- `GET /api/planets/megastera-proofs?recipient=...`
- `GET /api/planets?owner=...`, `GET /api/planets/:tokenId`
- `GET /api/planets/:tokenId/mining`, `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/current`, `/current/:address`, `/history`, and
  `/days/:periodId` (`/weeks` remains an alias); `POST /api/leaderboard/finalize` is worker-only

`api/serverMain.ts` is the standalone Node HTTP entry point. The Vite server remains
useful for frontend development, but a deployed API should run separately. Start it with:

```sh
set -a; . .env.local; set +a
pnpm api:server
```

The default listener is `127.0.0.1:8787`; override it with
`MEGAPLANETS_API_HOST` and `MEGAPLANETS_API_PORT`. The process can start with missing
secrets so liveness stays observable, while readiness and voucher routes fail closed
with `503` until server configuration is complete.

`api/planetIndexerMain.ts` is the separate long-running indexer entry point. The HTTP
server does not start it. Run the local rehearsal stack in two processes:

```sh
set -a; . .env.local; set +a
pnpm dev --host 127.0.0.1
```

```sh
set -a; . .env.local; set +a
pnpm api:indexer
```

The indexer uses finalized blocks, stores both cursor position and block hash, adapts
`eth_getLogs` ranges/backoff to provider limits, and logs cycle results. `GET
/api/planets/health` is a liveness probe and `GET /api/planets/readiness` validates the
required database, Base Sepolia RPC chain/code, configured signer, on-chain V2
`metadataSigner()`, contract address, and deployment-block configuration without exposing
secrets. `GET /api/planets/metrics` exposes only
safe process counters and the latest indexer summary; it never includes exception text,
RPC URLs, database URLs, Pinata credentials, or signer material. The metrics snapshot is
process-local, so production should export it to the chosen monitoring system rather than
treating it as a durable source of truth. Leaderboard finalization is an explicit
authenticated worker operation and must be scheduled outside public read traffic.

## V2 deployment closure and runtime gate

The active seasonless ERC721A V2 deployment record is Base Sepolia contract
`0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`, transaction
`0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`, block
`45,347,860`, with Sourcify `exact_match`. The exact script commands are:

- `cd contracts && ./script/deploy-v2-approved.sh`
- `set -a; . .env.local; set +a; (cd contracts && ./script/verify-v2-basescan.sh)`

The verification script must only run when the local gitignored `.env.local`
provides `BASESCAN_API_KEY`; otherwise it exits without attempting a network
verification.

BaseScan verification by itself does not authorize runtime activation.

The API must continue to fail closed by default. Do not add checked-in runtime defaults
for V2 activation. Only after the full rehearsal gate passes may runtime env activate V2
by setting the frontend env `VITE_MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`
and the backend envs
`MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` plus
`MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860` together, while keeping
`MEGAPLANETS_LAUNCH_BLOCK=44997183` and `TICKET_SOURCE=MEGAPLANETS_V1` unchanged.

## Production limitations

The file store is appropriate only for one local process and is rejected by the production
voucher service when `NODE_ENV=production`. Production requires PostgreSQL,
durable edge rate limiting, secret storage, operational scheduling, monitoring, backups,
and restore/rollback procedures. Ticket vouchers remain bound to the original
`TicketPurchased` recipient, while the contract independently checks current live ticket
ownership.

The continuous Ticket indexer is retired; proofs are persisted only after receipt-time
RPC verification. The minimal Planet projector uses a block-hash cursor and FK-safe
deployment-scoped rewinds. A Planet reorg rewinds only a bounded recent window (12 blocks by default),
preserving unrelated deployments and legacy daily snapshots; a separate snapshot job owns
snapshot canonicality. Configure a larger window in the indexer caller when the provider's
finality/reorg assumptions require it. Focused cursor/reset and idempotency tests cover
replay behavior. A production rollout
still needs durable scheduling, monitoring, backups, and restore testing. Never expose the
metadata signer private key to browser code.

Megastera Proof eligibility starts at the activation boundary `44,996,796`, not at the
later Planet launch gate `44,997,183`. This preserves the first activation purchases
while keeping `TICKET_SOURCE=MEGAPLANETS_V1` and the launch gate immutable. Configure
`BASE_SEPOLIA_RPC_FALLBACK_URLS` with comma-separated archive-capable endpoints when the
primary RPC does not serve historical receipts.
The runtime worker does not scan or advance a Ticket cursor; it projects only finalized
Planet mint and ownership events.
