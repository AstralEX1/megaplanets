# Planet Indexing and Play Resume Recovery Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Planet ownership indexing on Base Sepolia and make Play resume an unsigned expedition by issuing exactly the missing wallet request.

**Architecture:** Keep the existing Prisma-backed Planet indexer and expedition session format. Fix the Prisma transaction callback so its tagged `$queryRaw` call retains the transaction client as `this` and returns a supported scalar instead of PostgreSQL `void`. Make Play resume branch on the persisted purchase transaction hash: re-submit only sessions that have no transaction hash, while sessions with a hash continue through the existing confirmation/reveal flow.

**Tech Stack:** TypeScript, React, wagmi/viem, Prisma, Vitest, Vite, pnpm, Base Sepolia.

## Global Constraints

- Preserve unrelated working-tree changes, including the quantity-slider work.
- Keep all source identifiers and technical documentation in English.
- Use the current `.env.local` as the runtime environment; verify only presence and format, never print secret values.
- Keep `TICKET_SOURCE` equal to `MEGAPLANETS_V1` and preserve the existing Base Sepolia contract configuration.
- Do not introduce schema, contract, or package-manager changes for this bugfix.

---

### Task 1: Resume pending direct and bulk purchases

**Files:** `src/pages/Play.test.tsx`, `src/pages/Play.tsx`

- [x] Add a direct-purchase regression test with a persisted session whose `purchaseTxHash` is `null`; click `Resume` and assert `useBuyTickets().buy` receives the saved quantity, saved coordinates, and current ticket bounds.
- [x] Add a bulk-purchase regression test with a persisted session whose `purchaseTxHash` is `null`; click `Resume` and assert the bulk order creation callback runs once.
- [x] Run the focused Play test file and observe both new tests fail before changing production code.
- [x] Update `resume` to use the saved session values and invoke the matching direct or bulk purchase action only when `purchaseTxHash` is absent.
- [x] Keep the existing saved-transaction resume behavior and assert it does not issue a duplicate wallet request.
- [x] Re-run the focused Play tests.

### Task 2: Preserve Prisma transaction context during indexing

**Files:** `api/planetIndexer.test.ts`, `api/planetIndexer.ts`

- [x] Extend the existing Planet transfer/indexing fixture with a `$queryRaw` spy that verifies it is called with the transaction client as `this` and returns a supported scalar projection.
- [x] Run the focused indexer tests and observe the context regression fail with the current unbound call.
- [x] Invoke `$queryRaw` as a member of the transaction client so Prisma retains its internal context while acquiring the advisory lock, and project the result to `SELECT 1 AS locked` for Prisma 7.
- [x] Re-run the focused indexer tests and the runner tests.

### Task 3: Verify the live recovery and repository checks

**Files:** No additional production files.

- [x] Re-read `.env.local` through a dotenv-style shell load and report only required-key presence, private-key/address/block formats, and signer/E2E key equality.
- [x] Confirm the single missing ownership-history migration, apply it without resetting data, and verify both cursors remain healthy.
- [x] Run live `pnpm api:indexer` cycles against the configured Base Sepolia RPC and database; the first successful cycle processed 25 Planet events and the immediate repeat processed 0, with no reorg flags.
- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [x] Run `git diff --check` and review the final diff to confirm only the requested fixes and their regression tests changed.
