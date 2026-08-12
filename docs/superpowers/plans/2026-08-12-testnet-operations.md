# Testnet Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MegaPlanets Base Sepolia API and finalized indexer runnable as separately monitored services, with deterministic readiness/metrics, CI verification, and an operations runbook.

**Architecture:** Keep the existing Hono application and finalized indexer as separate processes. Add a small Node HTTP adapter for the Hono app, process-local operational snapshots, structured indexer cycle logs, and public-safe health/readiness/metrics endpoints. Keep all V2 activation values and credentials environment-only; no mainnet or live contract changes are part of this stage.

**Tech Stack:** TypeScript, Node.js 22, Hono, viem, Prisma, pnpm, Vitest, GitHub Actions, Foundry.

## Global Constraints

- Target Base Sepolia only; keep `TICKET_SOURCE=MEGAPLANETS_V1`.
- Never commit secrets or expose database URLs, Pinata JWTs, or signer keys.
- Keep checked-in V2 runtime defaults disabled.
- Use pnpm and the existing TypeScript/React/Biome/Vitest conventions.
- Preserve the existing live V2 deployment and remote rehearsal data; do not reset or delete the remote database.
- Every meaningful behavior change gets a focused test before implementation.
- Required verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:validate`, and Foundry unit/fuzz/bounded invariant checks.

---

### Task 1: Operational snapshot and safe service probes

**Files:**
- Create: `api/operations.ts`
- Create: `api/operations.test.ts`
- Modify: `api/index.ts`
- Modify: `api/planetIndexerMain.ts`
- Test: `api/index.test.ts`

**Interfaces:**
- `createOperationalState({ role, now? })` returns a process-local state object with `recordIndexerCycle`, `recordIndexerFailure`, `snapshot`, and `reset`.
- `createApp({ operations })` exposes `GET /api/planets/metrics` with only counts/timestamps/lag values and keeps `/health` liveness-only.
- The indexer worker records cycle results and errors without changing indexing semantics.

- [x] **Step 1: Write failing tests** for initial metrics, successful cycle recording, failure recording, and JSON-safe redaction.
- [x] **Step 2: Run `pnpm vitest run api/operations.test.ts api/index.test.ts`** and verify the new tests fail because the state/endpoints do not exist.
- [x] **Step 3: Implement the minimal state module and wire it into the API/indexer process.**
- [x] **Step 4: Run the focused tests and verify they pass.**
- [x] **Step 5: Add a test that readiness remains 503 when required V2/database configuration is absent.**

### Task 2: Standalone Node API process

**Files:**
- Create: `api/serverMain.ts`
- Create: `api/serverMain.test.ts`
- Modify: `package.json`
- Modify: `api/README.md`
- Modify: `docs/V2_INDEXER_REHEARSAL_RUNBOOK.md`

**Interfaces:**
- `pnpm api:server` starts the Hono API on `MEGAPLANETS_API_HOST` (default `127.0.0.1`) and `MEGAPLANETS_API_PORT` (default `8787`).
- The server must use the existing `createApp` and `loadStage5Config` paths and must fail closed when required secrets/configuration are missing.
- `GET /api/planets/health` and `GET /api/planets/readiness` work without Vite.

- [x] **Step 1: Write failing adapter/config tests** for default host/port parsing and Request/Response forwarding.
- [x] **Step 2: Run the focused tests and verify failure.**
- [x] **Step 3: Implement the Node HTTP adapter with graceful SIGINT/SIGTERM shutdown and no secret logging.**
- [x] **Step 4: Add the `api:server` script and any minimal runtime dependency using pnpm.**
- [x] **Step 5: Run focused API server tests and a local health smoke.**

### Task 3: CI and operational documentation

**Files:**
- Modify: `.github/workflows/verify.yml`
- Modify: `README.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/V2_INDEXER_REHEARSAL_RUNBOOK.md`
- Modify: `.env.example`

**Interfaces:**
- CI installs with pnpm, generates Prisma Client before checks, runs frontend/API verification, and runs bounded Foundry unit/fuzz/invariant checks.
- Runbook documents separate API/indexer processes, health/readiness/metrics checks, environment categories, log/lag response, backup/restore ownership, and rollback without exposing secrets.
- README and STATUS reflect the deployed V2, the 213-test verification baseline, and the remaining operations gate.

- [x] **Step 1: Write the workflow and documentation changes without adding credentials.**
- [x] **Step 2: Validate YAML/config text and run local equivalents of every CI command.**
- [x] **Step 3: Update the stage status and remaining blockers only after local verification passes.**

### Task 4: Final verification and checkpoint

**Files:**
- No new production files; review all Task 1-3 changes.

- [x] **Step 1: Run `pnpm lint`, `pnpm db:validate`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.**
- [x] **Step 2: Run Foundry unit, fuzz, and bounded invariant tests.**
- [x] **Step 3: Run `git diff --check` and a secret-pattern scan over tracked files.**
- [ ] **Step 4: Commit the stage with an explicit operations message and push `main`.**
- [ ] **Step 5: Stop at the stage boundary and report changed files, verification results, observable endpoints, and the external deployment inputs still required.**
