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
pnpm dev --host 127.0.0.1
```

In a second terminal:

```sh
set -a; . .env.local; set +a
pnpm api:indexer
```

Use `GET /api/planets/health` for liveness and `GET /api/planets/readiness` for V2
configuration readiness. The indexer emits cycle counts and reorg flags; use a Base
Sepolia RPC that accepts the configured 2,000-block log range. The public Nodies endpoint
used during setup is capped at 50 blocks and is unsuitable for the default runner range.

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

Only after that gate passes may runtime env activate V2 by setting the frontend
V2 env and backend V2 envs together:

```sh
VITE_MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2
MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2
MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860
```

Keep `MEGAPLANETS_LAUNCH_BLOCK=44997183` and `TICKET_SOURCE=MEGAPLANETS_V1`
unchanged. Never commit the activation values as defaults.
