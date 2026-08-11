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
  V2 Planet events. Both cursors reached the same finalized tip with block hashes.
- A repeat cycle returned zero new tickets/Planet events with both reorg flags false;
  ticket and Planet row counts remained unchanged.
- Chainlist-listed public RPCs were used as read-only fallbacks; Tenderly, DRPC,
  Sentio, and PublicNode accepted the tested 2,000-block `eth_getLogs` range.
- Selected smallest eligible unminted ticket:
  `369655895285474687617509885184844170268536768125201373131526793984064136106`.
  Its current on-chain owner is `0xCfc1044C749fD40E07FE33938414Fa573993F857`.
- No live wallet transaction, transfer, or burn has been submitted. The V2 runtime
  remains disabled until the voucher service and one approved mint gate pass.

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
