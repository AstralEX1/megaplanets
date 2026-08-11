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
- BaseScan status: pending until a session provides `BASESCAN_API_KEY`

## Exact commands

The approved deployment evidence in this repository came from these commands:

```sh
cd contracts
./script/deploy-v2-approved.sh
```

BaseScan verification is a separate, opt-in follow-up step:

```sh
cd contracts
BASESCAN_API_KEY=... ./script/verify-v2-basescan.sh
```

`./script/verify-v2-basescan.sh` is intentionally non-interactive. It exits
without making a network request when `BASESCAN_API_KEY` is absent from the
current session environment.

## Runtime activation gate

Do not enable checked-in defaults. The deployed V2 stays inactive in normal
runtime until all of the following are true together:

1. The deployment record above still matches on-chain owner, metadata signer,
   ticket NFT, bytecode, and ABI expectations.
2. Sourcify evidence is retained and BaseScan verification has either completed
   or is explicitly recorded as still pending because no session key was
   available.
3. Task 2 reorg-safe replay, Task 3 mining transition fixes, and Task 4 test
   coverage have passed.
4. Task 5 rehearsal has backfilled a disposable PostgreSQL database, rerun
   replay idempotently, and confirmed one explicit approved mint end to end.

Only after that gate passes may runtime env activate V2 by setting all three
values together:

```sh
VITE_MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2
MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2
MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860
```

Keep `MEGAPLANETS_LAUNCH_BLOCK=44997183` and `TICKET_SOURCE=MEGAPLANETS_V1`
unchanged. Never commit the activation values as defaults.
