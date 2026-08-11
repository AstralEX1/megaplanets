# MegaPlanets MVP Completion and Base Sepolia Plan

## Scope lock

The testnet MVP has one complete game loop:

```text
Buy a Megapot ticket
  -> claim one MegaPlanets NFT per eligible ticket
  -> indexed planets passively earn minerals
  -> matching planet types receive a production bonus
  -> earned minerals determine the weekly leaderboard
```

The following work is out of scope unless explicitly reopened: Colonize, XP,
colony levels, expeditions, referral prize pools, Merkle rewards, and mainnet
deployment. The ERC721A V2 collection is the one
explicitly approved exception because it enables gas-efficient Planet batch minting.

The deployed Base Sepolia MegaPlanets V1 contract remains available for existing
test tokens, but it is non-upgradeable. ERC721A therefore requires a clean
Base Sepolia V2 deployment before the public testnet release.

V2 Planet token IDs are sequential, starting at `1`. Each token retains its
Megapot provenance through immutable bidirectional ticket-to-Planet mappings.

## Existing batch mint support

The V2 collection exposes the required batch mint operation for MegaPlanets
NFTs:

```solidity
mintBatch(MintVoucher[] vouchers, bytes[] signatures)
```

It mints up to 50 ticket-backed Planet NFTs to the connected wallet in one
atomic Base Sepolia transaction. Every voucher is verified before any token is
minted: recipient, expiry, season, immutable metadata hash, signer, current
Megapot ticket ownership, duplicate ticket IDs, and prior mint state. The
contract then calls ERC721A `_safeMint(recipient, quantity)` once.

This is intentionally different from thirdweb `ERC721LazyMint`: each mint must
prove ownership of a live Megapot ticket. ERC721A uses consecutive Planet token
IDs and mappings instead of trying to use sparse ticket IDs, which would remove
the batch-mint gas benefit.

The frontend batch reveal control requests one voucher per eligible ticket,
simulates `mintBatch`, and sends one wallet transaction. The batch ABI is part
of the checked-in frontend contract ABI.

## Stage 1 - Scope cleanup and release baseline

### Goal

Establish a reviewable MVP baseline without deleting unreviewed user work.

### Keep

- Existing direct and bulk Megapot ticket purchase flows.
- Exact USDC approvals, dynamic drawing reads, `MEGAPLANETS_V1`, and receipt
  confirmation.
- The deterministic generator, metadata/GIF pipeline, ticket-backed EIP-712
  voucher flow,
  and individual and batch Planet minting.
- Planet event indexing, PostgreSQL/Prisma foundations, and ownership history.
- UI improvements unrelated to removed gameplay modes.

### Remove or defer

- Colonize, XP, colony level, expedition, and target-planet intent work.
- Diversity scoring. The MVP uses only same-type production bonuses.
- Referral pool and reward-claim systems.

### Baseline actions

1. Review the dirty worktree file-by-file before deleting anything. Existing
   changes may belong to the user and must not be reset wholesale.
2. Record the V1 deployment block and prepare a separate V2 deployment block.
3. Pin ERC721A v4.3.0, verify V2's ticket-to-token mappings and keep its ABI,
   indexer, and frontend batch control aligned.
4. Update outdated architecture and product documents to the scope lock.
5. Create a checkpoint commit only after the reviewed MVP diff is clean.

### Stage 1 exit criteria

- No active source path implements an out-of-scope gameplay mode.
- Batch mint, ERC721A sequential IDs, and ticket provenance mappings are
  covered by Solidity tests and batch mint is reachable in the Planet reveal UI.
- The working tree is classified before any destructive cleanup.
- Lint, typecheck, unit tests, build, and Foundry tests are rerun with the
  available toolchain.

## Stage 2 - Planet indexing and database

### Goal

Make the backend the canonical source for V2 minted planets and current ownership.

### Work

- Complete Prisma migrations for planets, ownership history, processed chain
  events, ticket provenance, and indexer cursors.
- Run an independent finalized-log worker for `PlanetMinted` and ERC-721A
  `Transfer` events.
- Use transactional event idempotency keyed by chain ID, contract address,
  transaction hash, and log index.
- Backfill from the V2 deployment block with bounded RPC ranges and reorg
  rewind support.
- Re-derive traits and `baseMineralsPerDay` from canonical ticket provenance.

### Public API

- `GET /api/planets/:tokenId`
- `GET /api/wallets/:address/planets`
- `GET /api/indexer/health`
- Existing `POST /api/planets/vouchers`

### Done when

A fresh database can be backfilled without duplicate planets or ownership rows,
and a V2 single or batch mint appears through the API with canonical traits and
the correct Megapot ticket provenance.

## Stage 3 - Passive mining and same-type bonus

### Goal

Calculate earned minerals lazily without a per-planet accrual cron.

### Rules

- Store mineral amounts in fixed-point integers using `MINERAL_SCALE = 1_000_000`.
- Store bonuses in basis points.
- Track time-bounded production rate segments.
- Settle a previous segment before mint or transfer changes a holder's bonus.
- Production before a transfer belongs to the previous owner.

Initial same-type rule, stored as configuration:

| Matching type count | Production bonus |
| ---: | ---: |
| 1 | 0% |
| 2 | 5% |
| 3 | 10% |
| 4+ | 15% maximum |

Minerals are permanent off-chain leaderboard score.

### Done when

Minerals grow from elapsed time, matching-type bonuses update correctly after
mint and transfer, and results are reproducible from persisted rate segments.

## Stage 4 - Weekly leaderboard

### Goal

Rank wallets by minerals earned during a UTC week, whether or not they visit
the application.

### Rules

- A week runs Monday 00:00 UTC through the next Monday 00:00 UTC.
- The live score includes closed segments and pending production through the
  current timestamp or period end.
- Ties sort by normalized wallet address.
- Finalization settles segments at period end and locks the archived week.

### Public API

- `GET /api/leaderboard/current`
- `GET /api/leaderboard/current/:address`
- `GET /api/leaderboard/history`
- `GET /api/leaderboard/weeks/:periodId`

### Done when

The visible rank, distance to the next rank, countdown, and completed-week
history can be recomputed from rate segments and weekly records.

## Stage 5 - Testnet operations and deployment readiness

### Goal

Run the API and indexer safely as separate testnet services.

### Work

- Deploy PostgreSQL on Supabase and apply Prisma migrations.
- Deploy Hono API and a separate indexer worker to a long-running Node host.
- Deploy the React app to Vercel or equivalent static hosting.
- Use a managed Base Sepolia RPC; public RPC is development-only fallback.
- Keep database, Pinata, RPC, and metadata signer credentials in host secret
  storage only.
- Add health/readiness endpoints, structured logs, indexer lag monitoring,
  retries, backups, and a rollback runbook.

### Required environment categories

- Public frontend configuration: chain, RPC URL, V2 contract address, season,
  and API base URL.
- Server-only configuration: database URLs, managed RPC URL, Pinata JWT,
  metadata signer private key, V2 deployment block, and allowed application
  origin.

### Done when

The API, indexer, and frontend run against an isolated Base Sepolia database
with no signing credential exposed to the browser.

## Stage 6 - Controlled Base Sepolia rehearsal

### Goal

Prove the entire MVP flow with canonical chain evidence.

1. Deploy and verify V2 only after explicit approval, then create a clean
   staging database and run migration plus V2 backfill.
2. Buy a controlled testnet ticket using the existing Megapot purchase flow.
3. Confirm the canonical `TicketPurchased` receipt and generate a voucher.
4. Mint one Planet, then mint multiple eligible Planet NFTs through
   `mintBatch` in one transaction.
5. Verify IPFS metadata, owner indexing, miner production, same-type bonus,
   transfer settlement, and live leaderboard ranking.
6. Finalize a test week and verify archived standings.

A V2 contract deployment, Base Sepolia purchase, or mint transaction requires
explicit user approval immediately before execution.

## Stage 7 - Testnet release

### Goal

Publish the verified MVP to public testnet users.

### Release gate

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- Foundry unit, fuzz, invariant, and ERC721A batch-gas regression tests pass
  when Foundry is available.
- A staging buy, individual mint, batch mint, transfer, mining, bonus, and
  leaderboard rehearsal has passed.
- Contract address, ABI, Megapot addresses, and receipt decoding have been
  checked against current official protocol documentation.
- Database restore and service rollback steps have been rehearsed.

### Rollback

- Roll back frontend and API releases independently.
- Stop the indexer before correcting corrupted processing state.
- Use forward-only database fixes or a tested restore; never modify either
  immutable NFT collection.

## Security invariants

- The frontend is never authoritative for ticket eligibility, ownership,
  metadata, mining, or leaderboard score.
- Megapot ticket price, draw state, limits, and locks are dynamic reads.
- Every MegaPlanets purchase uses `MEGAPLANETS_V1`, a configured non-dead
  referrer, exact USDC approval, and receipt verification.
- API integers are serialized as decimal strings; JavaScript `number` is not
  used for onchain or mineral quantities.
- Wallet addresses are normalized before persistence or ranking.
- Private keys are never committed or sent to the browser.
