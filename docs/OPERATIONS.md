# Operations and deployment runbook

This runbook is for the current Base Sepolia seasonless V2 deployment. It assumes no
secrets are committed and no transaction is sent without an explicitly approved funded
environment.

## Required services and environment

Run the frontend, API, finalized Planet projector, and daily leaderboard worker as
separate processes. Production uses managed PostgreSQL; the local JSON store is for one
process only and is rejected by the production voucher service.

Required server values:

```text
BASE_SEPOLIA_RPC_URL
BASE_SEPOLIA_RPC_FALLBACK_URLS       # optional comma-separated archive-capable URLs
DATABASE_URL
MEGAPLANETS_METADATA_SIGNER_PRIVATE_KEY
PINATA_JWT
MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2
MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860
MEGAPLANETS_LAUNCH_BLOCK=44997183
MEGAPLANETS_CONFIRMATIONS=6
MEGAPLANETS_ALLOWED_ORIGINS=https://<frontend-origin>
MEGAPLANETS_WORKER_TOKEN=<scheduler-only secret>
```

Frontend activation uses the same V2 address in
`VITE_MEGAPLANETS_CONTRACT_ADDRESS`, `VITE_CHAIN=testnet`, and a matching
`VITE_RPC_URL`. Keep `TICKET_SOURCE` equal to `MEGAPLANETS_V1`. Never put server secrets,
the signer key, database URL, Pinata JWT, or worker token in a `VITE_*` variable.

## Start and health checks

```sh
pnpm db:generate
pnpm db:validate
pnpm api:server
pnpm api:indexer
pnpm api:leaderboard-worker      # scheduler invokes this once per day
pnpm dev --host 127.0.0.1
```

Check:

- `GET /api/planets/health` — process liveness;
- `GET /api/planets/readiness` — database, RPC chain/code, V2 deployment block, and
  metadata-signer readiness;
- `GET /api/planets/metrics` — safe process counters and last projector cycle.

Readiness must remain closed (`503`) when server configuration is incomplete. Metrics are
process-local and must be exported or scraped by the hosting platform; they are not a
durable audit log.

For a split frontend/API deployment, set exact origins in
`MEGAPLANETS_ALLOWED_ORIGINS`. Empty means same-origin only. Wildcards, URL paths,
credentials, and malformed origins are rejected. The API body limit is 16 KiB; voucher
preparation is bounded by a process-local work limiter and rate limiter. Add a durable
edge limiter before running more than one API replica.

## Projector backfill and recovery

The projector starts at the V2 deployment block and consumes finalized `PlanetMinted` and
ERC721A `Transfer` events only. It stores the last finalized block hash with its cursor.
The normal cycle is:

1. choose the finalized range using the configured confirmation depth;
2. compare the cursor boundary hash with the chain;
3. on boundary mismatch, stop and replay the full V2 deployment scope because one
   boundary hash cannot prove a safe recent common ancestor;
4. delete dependent artifact/voucher/ticket rows in FK-safe order when a ticket proof is
   inside the rewind window;
5. replay events idempotently; and
6. advance the v2 cursor only after all writes succeed.

The activation recovery window for Megastera Proof is separate: ticket discovery starts at
block `44996796` and the immutable launch gate remains `44997183`. The continuous Ticket
indexer is retired; proofs are created from receipt-time verification.

After a restore or rewind, verify:

- cursor `nextBlock` and `lastBlockHash` for `megaplanets-v2`;
- sequential Planet IDs and one `PlanetMinted` plus initial Transfer per mint;
- current `ownerAddress` against finalized `ownerOf` reads;
- artifact/voucher rows against their immutable receipt keys; and
- a second replay produces zero conflicting writes.

Never delete the production database as a first response. Stop the indexer, preserve the
on-chain source of truth, restore into a disposable database first, and compare counts and
hashes before promotion.

## Leaderboard operations

`api/leaderboardWorker.ts` is the only scheduled mutator. It finalizes every completed UTC
day from immutable Planet rate and mint-time data. Public `/api/leaderboard/current`,
`/history`, and `/days/:periodId` routes are read-only. The finalize route, when exposed
for scheduler integration, requires `Authorization: Bearer $MEGAPLANETS_WORKER_TOKEN`.

Alert on worker failure, a growing finalization backlog, an empty snapshot after known
minted Planets, and disagreement between indexed current owners and direct RPC reads.

## Voucher/media safety

The server verifies receipt status, confirmation depth, canonical block hash, recipient,
source, drawing, and ticket data before signing. `PlanetArtifact` is immutable and keyed
by the origin transaction hash plus log index. WebM is bounded by the generator tests and
must remain `video/webm`; GIF fixtures are not a runtime fallback for newly minted media.

## Release gate

From the repository root:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
```

From `contracts/`:

```sh
forge build --sizes
forge test
./script/check-abi.sh
```

Before a public testnet release, run a funded direct purchase, keeper bulk execution,
voucher preparation, single/batch mint, transfer/burn, projector replay, and leaderboard
finalization in a disposable or approved environment. A simulation is not evidence of a
live transaction. Browser smoke must cover Play → My Planets → Leaderboard plus loading,
empty, and error/recovery states when a real browser connection is available.
