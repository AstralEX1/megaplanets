# Reveal Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize receipt-backed voucher preparation and safe single/batch Reveal for Base Sepolia tickets.

**Architecture:** Preserve the existing API, store, generator, and V2 contract boundaries. Add narrow backend validation/error helpers and frontend selection/chunk helpers, then integrate them into the existing routes/components with TDD.

**Tech Stack:** TypeScript, Hono, viem, Prisma, React, wagmi, TanStack Query, Vitest.

## Global Constraints

- Base Sepolia `84532` and deployed V2 `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2` only.
- `MEGAPLANETS_V1` remains the ticket source; Data API is discovery only.
- No contract deployment/change, continuous Ticket indexer, secret exposure, or destructive DB operation.
- Contract batch size is at most 50; bigint values remain bigint until serialization/display.
- Tests must be observed RED before production changes and GREEN afterward.

---

### Task 1: Backend voucher validation and safe errors

**Files:**
- Create: `api/voucherErrors.ts`
- Modify: `api/index.ts`
- Modify: `api/rpc.ts` only if the existing fallback helper cannot keep canonical reads on one healthy endpoint
- Test: `api/index.test.ts`

**Interfaces:**
- Produce a typed safe failure `{ code, stage, message, requestId }` for voucher routes.
- Ensure receipt, latest block, canonical block, timestamp, ticket `ownerOf`, and Planet `ticketToPlanet` validation occur before signing.

- [ ] Add failing route tests for fallback canonical reads, wrong owner, burned/claimed ticket, already minted ticket, stage code, and request ID.
- [ ] Run `pnpm exec vitest run api/index.test.ts` and record the expected failures.
- [ ] Implement the smallest injected chain-validation boundary and safe error mapping; do not expose raw provider errors.
- [ ] Preserve the existing ordered/atomic `/vouchers/batch` compatibility contract; defer per-item partial results until after the hackathon.
- [ ] Run the focused tests until GREEN and lint/typecheck the owned files.

### Task 2: Artifact integrity and expired voucher regeneration

**Files:**
- Modify: `api/service.ts`
- Modify: `api/prismaEligibilityStore.ts`
- Modify: `api/store.ts` only for parity with production behavior
- Test: `api/service.test.ts` or the existing nearest service/store tests
- Test: `api/prismaEligibilityStore.test.ts`

**Interfaces:**
- Existing artifacts are accepted only when all immutable derived fields match the proof and canonical descriptor.
- An expired voucher reuses the verified artifact and receives a new expiry/signature without repinning.

- [ ] Add failing tests for seed/traits/URI/media conflicts and expired voucher regeneration without repinning.
- [ ] Run the focused tests and record RED.
- [ ] Implement full immutable comparisons and preserve the current process-local in-flight coalescing boundary; defer cross-replica pin coordination.
- [ ] Run focused tests until GREEN and lint/typecheck the owned files.

### Task 3: Exact candidate selection and chunked reveal

**Files:**
- Create: `src/lib/revealPlan.ts`
- Modify: `src/pages/Play.tsx`
- Modify: `src/components/planets/MintPlanetBatchButton.tsx`
- Modify: `src/lib/planetVoucher.ts`
- Modify: `src/lib/queryInvalidation.ts` if mining invalidation is missing
- Test: `src/lib/revealPlan.test.ts`
- Test: `src/pages/Play.test.tsx`
- Test: `src/components/planets/MintPlanetBatchButton.test.tsx`

**Interfaces:**
- Build a stable deduplicated reveal plan from exact direct/keeper execution receipt references.
- Return `ready` groups of at most 50 and explicit skipped reasons; unreadable ownership remains an error.

- [ ] Add failing tests proving old same-drawing tickets cannot replace new execution tickets, duplicates are stable, and 51+ becomes 50 plus remainder.
- [ ] Add failing component tests for deterministic skips, unreadable fail-closed behavior, double-submit prevention, wallet rejection/revert, and post-confirmation invalidation.
- [ ] Run focused tests and record RED.
- [ ] Implement the pure reveal plan and minimally wire it into Play and mint buttons.
- [ ] Parse backend error `code`, `stage`, and `requestId` without losing the safe message.
- [ ] Run focused tests until GREEN and lint/typecheck the owned files.

### Task 4: Review and stage verification

**Files:**
- Modify only files required by reviewed critical/high or justified medium findings.

- [ ] Run independent Luna Max backend/security and frontend/UX reviews against the design.
- [ ] Fix load-bearing findings using RED-GREEN tests and run scoped re-reviews.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:generate`, and `pnpm db:validate`.
- [ ] Run read-only Base Sepolia receipt/ownership/voucher simulations for the supplied wallets using the source `.env.local` without printing secrets.
- [ ] Commit coherent Stage C checkpoints and report changed files, behavior, evidence, and deferred non-stage work.
