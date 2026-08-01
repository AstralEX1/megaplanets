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

## Megapot integration rules

- Read `.agents/skills/megapot/SKILL.md` before changing Megapot contract calls,
  addresses, event decoding, drawing lifecycle behavior, or Data API usage.
- Treat `https://llms.megapot.io/` as the protocol source of truth.
- Target Base Sepolia until a later stage explicitly authorizes mainnet work.
- Read ticket price, drawing ID, ball limits, fees, and lifecycle state dynamically.
- Keep `TICKET_SOURCE` equal to `MEGAPLANETS_V1`.
- Never deploy with the dead referrer address.
- Keep USDC approvals exact-amount unless a documented decision changes the policy.

## Code conventions

- Follow existing TypeScript, React, wagmi, viem, TanStack Query, Tailwind, and
  Biome patterns from the starter kit.
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
