# V2 Indexer Rehearsal Runbook

This runbook is the durable operations record for the deployed Base Sepolia
MegaPlanets ERC721A V2 while runtime activation stays disabled.

## Current deployment record

- Chain: Base Sepolia (`84532`)
- V2 contract: `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`
- Deployment transaction: `0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`
- Deployment block: `45,347,860`
- Ticket source: `MEGAPLANETS_V1`
- Ticket launch block: `44,997,183`
- Sourcify status: `exact_match`
- BaseScan status: verified on 2026-08-11 using the local gitignored rehearsal
  environment; that status alone does not authorize runtime activation

## Long-running local stack

The metadata/voucher HTTP service is mounted by Vite for the local rehearsal, while the
finalized indexer runs as a separate process. Keep the V2 values in the gitignored
`.env.local` only:

```sh
set -a; . .env.local; set +a
pnpm api:server
```

In a second terminal:

```sh
set -a; . .env.local; set +a
pnpm api:indexer
```

Run the Vite frontend separately when a browser is needed:

```sh
pnpm dev --host 127.0.0.1
```

Use `GET /api/planets/health` for liveness and `GET /api/planets/readiness` for V2
configuration readiness. `GET /api/planets/metrics` exposes safe process counters; it
does not expose credentials and is not a durable monitoring source. The indexer emits cycle
counts and reorg flags; use a Base
Sepolia RPC that accepts the configured 2,000-block log range. The public Nodies endpoint
used during setup is capped at 50 blocks and is unsuitable for the default runner range.

The API defaults to `127.0.0.1:8787`; override with `MEGAPLANETS_API_HOST` and
`MEGAPLANETS_API_PORT`. It may start with incomplete secrets so liveness remains visible,
but readiness, auth, mining, and voucher routes fail closed until configuration is valid.

## Operations checklist

- Store `DATABASE_URL`, `DIRECT_URL`, `BASE_SEPOLIA_RPC_URL`, `PINATA_JWT`, and
  `MEGAPLANETS_METADATA_SIGNER_PRIVATE_KEY` in the host secret manager only.
- Set the V2 address and deployment block atomically in API/indexer/frontend environments;
  keep checked-in defaults empty and keep `MEGAPLANETS_LAUNCH_BLOCK=44997183`.
- Scrape or poll health/readiness from the hosting platform and forward structured process
  logs. Alert on readiness failure, repeated indexer failures, stale cycles, reorg flags,
  and database connection errors.
- Back up PostgreSQL before schema changes and on a documented cadence; rehearse restore
  into a disposable database, run Prisma migrations, then replay both indexers from the
  recorded launch/deployment blocks and compare ticket, Planet, ownership, mining, and
  cursor counts.
- For rollback, stop the indexer first, roll back API/frontend artifacts independently,
  preserve immutable on-chain state, and use a forward-only migration or tested database
  restore. Do not delete the live database as a first response.

## Exact commands

The approved deployment evidence in this repository came from these commands:

```sh
cd contracts
./script/deploy-v2-approved.sh
```

BaseScan verification is a separate, opt-in follow-up step:

```sh
set -a
. .env.local
set +a
(cd contracts && ./script/verify-v2-basescan.sh)
```

`./script/verify-v2-basescan.sh` is intentionally non-interactive. It exits
without making a network request when `BASESCAN_API_KEY` is absent from the
local rehearsal environment.

For the disposable PostgreSQL rehearsal, fill `DATABASE_URL` and `DIRECT_URL`
in the same gitignored `.env.local` file. Never commit or print those values.

## Rehearsal evidence (2026-08-11)

- The test Supabase PostgreSQL schema was reset after explicit user confirmation;
  all four repository migrations applied successfully.
- Finalized Base Sepolia backfill indexed 460 `MEGAPLANETS_V1` tickets and zero
  V2 Planet events. After the rehearsal mint, the database contains 462 tickets,
  16 V2 Planets, 32 processed V2 events, 16 accrual states, and 16 ownership-history
  rows; both cursors have non-null block hashes.
- The post-mint cycle processed exactly two V2 events (`PlanetMinted` plus the same-tx
  `Transfer(0, recipient)`), with `reorgDetected=false`. A repeat cycle returned zero
  tickets and zero Planet events, also with both reorg flags false.
- Chainlist-listed public RPCs were used as read-only fallbacks; Tenderly, DRPC,
  Sentio, and PublicNode accepted the tested 2,000-block `eth_getLogs` range.
- Selected smallest eligible unminted ticket:
  `369655895285474687617509885184844170268536768125201373131526793984064136106`.
  Its current on-chain owner is `0xCfc1044C749fD40E07FE33938414Fa573993F857`.
- One authorized mint completed successfully after simulation and six confirmations:
  transaction `0x3607f5f37657457db6d2c3d3c03642e472f01e364468b772b6ec1811d8a21612`,
  block `45,353,701`, sequential token ID `16`, owner
  `0xCfc1044C749fD40E07FE33938414Fa573993F857`, and `totalSupply=16`.
  The on-chain token URI is `ipfs://bafkreieufr4d4ecwcsqjz5n57vbxfjwfqe2tmwan3nge6xzztjyy6ulwoq`.
  API and DB map the selected ticket to Planet #16 with the same owner and URI.
  No transfer or burn was submitted.

## Stage 7 continuation checkpoint (2026-08-12)

The deployment remains healthy on Base Sepolia in read-only preflight checks:

- `eth_chainId` returned `84532`.
- The V2 address returned deployed runtime bytecode and `totalSupply() = 41`.
- `owner()` returned `0xCfc1044C749fD40E07FE33938414Fa573993F857`.
- Megapot `currentDrawingId()` returned `7690` and the facilitator reported a
  dynamic minimum of `3` tickets.

The local Vite/API smoke-check also passed: `/` returned HTTP `200`,
`/api/planets/health` returned `{ "ok": true, "stage": 5 }`,
`/api/planets/metrics` returned HTTP `200`, and `/api/planets/readiness` correctly
returned HTTP `503` because runtime secrets and database configuration are not
present in this environment. No live purchase, mint, transfer, burn, or approval
transaction was submitted during this checkpoint.

The local contract suite passed with 11 unit tests, 2 fuzz tests (256 runs each),
and the invariant suite (8 runs at depth 40). A browser visual smoke-check could
not be performed because no browser connection is available in the current
environment; the HTTP smoke-check is the recorded fallback.

## Controlled E2E continuation (2026-08-12)

The approved test wallet was checked read-only before any write:

- ETH balance: `0.059610849887758417` ETH.
- USDC balance: `17.49` USDC.
- Jackpot and facilitator USDC allowances: both already at `uint256.max`; no
  approval transaction was needed or submitted.
- No active bulk order was present.

Drawing `7691` is open (`jackpotLock=false`), with ticket price `10,000` USDC
base units, `ballMax=25`, `bonusballMax=13`, and facilitator minimum `3`. Exact
viem simulations succeeded for one valid direct ticket and a three-ticket
all-random bulk order. These are simulations only; no purchase transaction was
signed or broadcast because no wallet private key is available to the runtime.

The finalized V2 event stream was independently checked through block `45,386,902`:

- `totalSupply() = 41` and there are 41 `PlanetMinted` plus 41 initial `Transfer`
  events from the deployment block.
- Token IDs are sequential `1..41`.
- All 41 `ticketIdByPlanetTokenId` and reverse mappings match their mint events.
- Every `ownerOf` recipient and every `tokenURI` hash matches its `PlanetMinted`
  event (`0` mapping, owner, URI, or RPC-call mismatches).
- The latest indexed mint is token `41`, transaction
  `0xffa2299fabcf5aa5b04fa3dce5b45814fef9c77b0b5046b14225b0829b857`, block
  `45,369,807`.

Targeted local replay, mining-transition, leaderboard, and runner tests passed;
the repository suite remains at 60 files and 238 tests. The remaining live E2E
scenarios are direct purchase receipt persistence, keeper execution, voucher
signing/metadata pinning, batch mint, transfer/burn, and production PostgreSQL
replay. They require the gitignored runtime secrets and a funded signer; they
must not be replaced with simulated success.

## Live E2E gate re-check (2026-08-12)

The gate was re-checked before attempting a write. No `.env.local` or server
runtime secrets are present, including `BASE_SEPOLIA_RPC_URL`, `DATABASE_URL`,
`PINATA_JWT`, and `MEGAPLANETS_METADATA_SIGNER_PRIVATE_KEY`; no wallet private
key is available either. The approved wallet and drawing remain readable, and
no approval, purchase, order, mint, transfer, or burn transaction was attempted.

The frontend was started with temporary, non-secret V2 address/RPC variables only:
the root page returned HTTP `200`, `/api/planets/health` returned HTTP `200`,
`/api/planets/metrics` returned HTTP `200`, and `/api/planets/readiness` returned
the expected HTTP `503` while server/database secrets are absent. The connected
browser bridge is unavailable in this environment, so this remains an HTTP
smoke-check rather than a visual/browser confirmation.

## Runtime activation gate

Do not enable checked-in defaults. The deployed V2 stays inactive in normal
runtime until all of the following are true together:

1. The deployment record above still matches on-chain owner, metadata signer,
   ticket NFT, bytecode, and ABI expectations.
2. Sourcify evidence is retained and BaseScan verification has completed.
   BaseScan verification by itself never authorizes activation.
3. Task 2 reorg-safe replay, Task 3 mining transition fixes, and Task 4 test
   coverage have passed.
4. Task 5 rehearsal has backfilled a disposable PostgreSQL database, rerun
   replay idempotently, and confirmed one explicit approved mint end to end.
5. Production operations have an owner, durable scheduling, lag/reorg alerting,
   backups, and a tested restore/rollback procedure.

Only after that gate passes may runtime env activate V2 by setting the frontend
V2 env and backend V2 envs together:

```sh
VITE_MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2
MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2
MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860
```

Keep `MEGAPLANETS_LAUNCH_BLOCK=44997183` and `TICKET_SOURCE=MEGAPLANETS_V1`
unchanged. Never commit the activation values as defaults.
