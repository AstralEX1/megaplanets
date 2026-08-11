# MegaPlanets V2 indexer hardening and live-mint rehearsal

## Context

The seasonless ERC721A V2 is deployed on Base Sepolia at
`0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` in transaction
`0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`, block
`45,347,860`. The ticket source remains V1 (`MEGAPLANETS_V1`), with ticket
launch block `44,997,183`; V2 runtime activation stays disabled until the
rehearsal gates pass.

## Global constraints

- Target Base Sepolia (chain ID `84532`) only.
- Keep the V2 address, deployment block, owner/metadata signer, ticket NFT, and
  ticket launch block exact as recorded above and in the deployment evidence.
- Do not print secrets. For this rehearsal, `DATABASE_URL`, `DIRECT_URL`, and
  `BASESCAN_API_KEY` may be stored only in the gitignored local `.env.local`
  file; never commit that file or copy its values into logs or documentation.
- Preserve users, authentication nonces, and sessions on every indexer reset.
- Keep public HTTP response schemas unchanged and keep runtime activation disabled
  until all gates pass.
- Keep `TICKET_SOURCE` equal to `MEGAPLANETS_V1`; read protocol values dynamically
  where the existing integration requires them; use exact-amount USDC approvals.
- Make resets transactional and FK-safe; replay must be idempotent.

## Tasks

### Task 1: Deployment closure and durable documentation

Reconcile the committed deployment scripts, Base Sepolia deployment identity,
Sourcify evidence, and BaseScan status. Attempt BaseScan verification only when
the local gitignored `.env.local` provides an API key. Document the exact commands and
runtime activation gate in this plan, `docs/STATUS.md`, `api/README.md`, and the
appropriate runbook.

Task 1 documentation must keep these exact commands and gates aligned:

- `cd contracts && ./script/deploy-v2-approved.sh`
- `set -a; . .env.local; set +a; (cd contracts && ./script/verify-v2-basescan.sh)`
- keep BaseScan pending when `.env.local` has no `BASESCAN_API_KEY`;
  BaseScan verification by itself does not authorize runtime activation
- keep the runtime activation gate env-only: do not check in defaults
- Only after the full rehearsal gate passes may runtime env activate V2 by
  setting the frontend env
  `VITE_MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`
  and the backend envs
  `MEGAPLANETS_CONTRACT_ADDRESS=0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`
  plus `MEGAPLANETS_PLANET_DEPLOYMENT_BLOCK=45347860` together
- keep `MEGAPLANETS_LAUNCH_BLOCK=44997183` and
  `TICKET_SOURCE=MEGAPLANETS_V1` unchanged

See [`docs/V2_INDEXER_REHEARSAL_RUNBOOK.md`](../../V2_INDEXER_REHEARSAL_RUNBOOK.md)
for the durable operations record.

### Task 2: Reorg-safe ticket and Planet indexing

Change both cursors to `{ nextBlock, lastBlockHash }`. Before each cycle compare
the stored hash with the canonical hash of `nextBlock - 1`. A Planet mismatch
transactionally clears only V2-derived state and replays from `45,347,860`. A
ticket mismatch transactionally clears tickets plus dependent V2-derived state and
replays tickets from `44,997,183` before Planets. Resets delete in FK-safe order:
leaderboard entries/periods; daily snapshots; mineral ledger/accrual states;
ownership history/processed V2 events; active V2 planets; and, for ticket reset,
vouchers, MegaPlanets ticket purchases, both cursors. Preserve users, auth nonces,
and sessions. Persist cursor/hash after every successful block range, including an
empty range, and report correct `reorgDetected` flags.

### Task 3: Mining transition correctness

Separate settlement from same-Type rate recomputation. `PlanetMinted` creates
initial zero-address ownership; same-transaction `Transfer(0, recipient)` starts
mining. A normal transfer settles sender and receiver using pre-transfer
composition, moves ownership/accrual, then reprices both post-transfer
compositions. A burn settles the sender, moves ownership to zero, removes active
zero-address accrual, and reprices the sender’s remaining Planets. Persist the
accrual remainder in `MineralLedgerEntry.fractionalRemainder`.

### Task 4: TDD coverage and verification

Add focused tests for cursor hash match/mismatch, empty-range hashes, Planet-only
and ticket-dependent resets, idempotent replay, sender bonus removal, receiver
bonus addition, burn stopping zero-address accrual, remainder continuity, and
`PlanetMinted`/`Transfer` same-transaction ordering. Run frontend/API tests,
lint, typecheck, production build, Prisma validation, and Foundry tests.

### Task 5: Disposable-DB rehearsal and live mint gate

When a new empty disposable remote PostgreSQL is available, apply migrations,
backfill tickets then Planets from Base Sepolia, and verify repeat runs are
idempotent. Start local backend/frontend with V2 configured only by runtime env.
Select the smallest eligible unminted ticket whose current on-chain owner is the
approved owner. Present exactly that ticket and wait for explicit approval for one
wallet mint; never request a private key or submit transfer/burn. After six
confirmations, rerun indexing and verify on-chain mappings/owner/total supply/
metadata, DB Planet/ownership/accrual, APIs, and UI. If no eligible ticket exists,
report that blocker without substituting another wallet’s ticket.

## Completion

Perform a broad code review, record fresh verification evidence, and use the
finishing-a-development-branch skill to present integration options. Do not enable
production defaults or perform live transfer/burn.
