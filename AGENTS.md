# MegaPlanets repository guidance

## Working language

- Write source code, identifiers, filenames, commit messages, tests, and technical
  documentation in English.
- User-facing copy may be localized later, but English is the source language.

## Workflow

- Work on only the stage explicitly requested by the user.
- Stop at the end of every stage and report changed files, verification results,
  and observable behavior.
- Preserve user changes and keep unrelated edits out of the current stage.
- Use pnpm. Do not introduce another JavaScript package manager.
- Never commit secrets. Use `.env.local`, host environment variables, or placeholders.
- For every task, read in this order: `AGENTS.md`, `README.md`, the relevant section of
  `docs/ARCHITECTURE.md`, then `docs/STATUS.md` and `docs/OPERATIONS.md` when deployment,
  indexing, or runtime configuration is involved. Historical plans/specs are not current
  requirements.
- Stop at the requested stage and report changed files, fresh verification output, and
  observable behavior before moving to a separate stage.

## Megapot integration rules

- Read `.agents/skills/megapot/SKILL.md` before changing Megapot contract calls,
  addresses, event decoding, drawing lifecycle behavior, or Data API usage.
- Treat `https://llms.megapot.io/` as the protocol source of truth.
- Target Base Sepolia until a later stage explicitly authorizes mainnet work.
- Read ticket price, drawing ID, ball limits, fees, and lifecycle state dynamically.
- Keep `TICKET_SOURCE` equal to `MEGAPLANETS_V1`.
- Never deploy with the dead referrer address.
- Keep the approved unlimited USDC approval policy: compare allowance with the exact required amount before every action; when insufficient, approve the route-specific spender with `maxUint256`, then refetch/invalidate allowance after a successful receipt.
- Current deployed V2 identity is Base Sepolia `84532`, contract
  `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`, deployment block `45347860`. Runtime
  activation remains environment-only; never copy it into checked-in defaults.
- Preserve these invariants: server-side receipt-verified Megastera Proof; direct
  ERC721A holdings by default; finalized PlanetMinted/Transfer projector only; lifetime
  mining from immutable mint time and base rate; daily UTC leaderboard snapshots; and
  immutable short WebM artifacts. Do not reintroduce a continuous Ticket indexer,
  accrual/ledger writes, same-type bonuses, transfer settlement, or application auth.

## Code conventions

- Follow existing TypeScript, React, wagmi, viem, TanStack Query, Tailwind, and
  Biome patterns from this repository.
- Keep bigint values as bigint until display formatting.
- Add or update tests for meaningful behavior changes.
- Keep shared deterministic generation logic free of browser-only global state.
- Prefer explicit errors over silent fallbacks.

## Required verification

- Frontend/config changes: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Contract changes: also run `forge test` and relevant fuzz/invariant tests.
- User-flow changes: add a focused Playwright smoke test when browser automation is
  introduced.

## Source orientation

- `src/` contains the current starter-kit frontend.
- `contracts/` will contain the Foundry project.
- `packages/planet-generator/` will contain the deterministic generator.
- `api/` will contain metadata, eligibility, indexing, and leaderboard services.
- `docs/` contains durable product and architecture decisions.

## Verification gate

From the repository root run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm db:generate`, and `pnpm db:validate`. Contract changes additionally require
`forge build --sizes`, `forge test`, invariant/fuzz coverage, and
`contracts/script/check-abi.sh`. If a gate is blocked by missing dependencies, network,
secrets, or a funded wallet, record the exact command and blocker; do not claim it passed.
