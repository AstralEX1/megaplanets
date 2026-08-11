# Off-chain Mining and Weekly Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect canonical lazy mineral accrual to My Planets and deliver a public, archived weekly leaderboard backed by PostgreSQL.

**Architecture:** Keep the existing immutable rate-segment ledger authoritative. Add pure weekly-period and ranking functions, a Prisma-backed finalization/query service, public Hono routes, then consume aggregated snapshots through TanStack Query. The browser interpolates display-only values between canonical server snapshots and never writes mineral state.

**Tech Stack:** TypeScript, Hono, Prisma/PostgreSQL, React 19, TanStack Query, wagmi, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Minerals are permanent off-chain score with no conversion or withdrawal lifecycle.
- Preserve Megapot prize claims, ticket purchase, drawing, mint, and transfer behavior.
- Keep `MINERAL_SCALE = 1_000_000n` and bigint values until decimal-string serialization.
- Weeks run Monday 00:00 UTC through the following Monday 00:00 UTC.
- Unrevealed tickets expose no generated Planet or mining data.
- Use pnpm and existing repository conventions; add no new dependency.
- Do not stage unrelated dirty-worktree files.

---

### Task 1: Weekly period and ranking domain

**Files:**
- Create: `api/leaderboard.ts`
- Create: `api/leaderboard.test.ts`

**Interfaces:**
- Produces `getLeaderboardPeriod(now: Date): LeaderboardPeriodBounds`.
- Produces `rankLeaderboardRows(rows: readonly UnrankedLeaderboardRow[]): RankedLeaderboardRow[]`.
- Produces `getDistanceToNextRank(rows, address): string | null`.

- [ ] **Step 1: Write failing UTC-boundary and ranking tests**

```ts
expect(getLeaderboardPeriod(new Date('2026-08-12T12:00:00.000Z'))).toEqual({
  id: '2026-08-10',
  startsAt: new Date('2026-08-10T00:00:00.000Z'),
  endsAt: new Date('2026-08-17T00:00:00.000Z'),
});
expect(rankLeaderboardRows([
  { walletAddress: ADDRESS_B, scoreMicros: 10n, effectiveMineralsPerDayMicros: 2n },
  { walletAddress: ADDRESS_A, scoreMicros: 10n, effectiveMineralsPerDayMicros: 1n },
])[0]).toMatchObject({ walletAddress: ADDRESS_A, rank: 1 });
```

- [ ] **Step 2: Run `pnpm test api/leaderboard.test.ts` and verify failure because the module is missing**
- [ ] **Step 3: Implement UTC Monday bounds, normalized-address tie sorting, and non-negative distance using bigint only**
- [ ] **Step 4: Run `pnpm test api/leaderboard.test.ts` and verify pass**

### Task 2: Period-scoped mining calculation

**Files:**
- Modify: `api/mining.ts`
- Modify: `api/mining.test.ts`
- Modify: `api/miningStore.ts`
- Modify: `api/miningStore.test.ts`

**Interfaces:**
- Produces `accrueMineralsForOverlap(segment, periodStart, periodEnd)`.
- Expands `getWalletMiningSnapshot(prisma, ownerAddress, now)` with `asOf`, `effectiveMineralsPerDayMicros`, and `planets`.

- [ ] **Step 1: Add a failing overlap test proving that a segment spanning a Monday boundary counts only time inside the requested week**
- [ ] **Step 2: Run `pnpm test api/mining.test.ts` and verify the missing export failure**
- [ ] **Step 3: Implement overlap clamping with `max(startedAt, periodStart)` and `min(endedAt, periodEnd)`**
- [ ] **Step 4: Add a failing store test expecting one aggregated query result shaped as:**

```ts
{
  ownerAddress: ADDRESS,
  asOf: '2026-08-12T12:00:00.000Z',
  ownedPlanetCount: 2,
  earnedMicros: '1250000',
  pendingMicros: '250000',
  effectiveMineralsPerDayMicros: '21000000',
  planets: [{
    tokenId: '1',
    baseMineralsPerDay: '10',
    multiplierBps: '10500',
    effectiveMineralsPerDayMicros: '10500000',
    pendingMicros: '125000',
    earnedMicros: '625000',
    activeSince: '2026-08-11T12:00:00.000Z',
  }],
}
```

- [ ] **Step 5: Implement the snapshot with parallel Planet and ledger reads and one pass over Planet rows**
- [ ] **Step 6: Run `pnpm test api/mining.test.ts api/miningStore.test.ts` and verify pass**

### Task 3: Durable weekly finalization

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260811_weekly_leaderboard/migration.sql`
- Create: `api/leaderboardStore.ts`
- Create: `api/leaderboardStore.test.ts`

**Interfaces:**
- Produces `getCurrentLeaderboard(prisma, now, pagination)`.
- Produces `getWalletLeaderboardPosition(prisma, address, now)`.
- Produces `finalizeLeaderboardPeriod(prisma, period, finalizedAt)`.
- Produces `listLeaderboardPeriods(prisma, pagination)` and `getArchivedLeaderboard(prisma, periodId, pagination)`.

- [ ] **Step 1: Add Prisma models `LeaderboardPeriod` and `LeaderboardEntry` with unique period IDs and `(periodId, walletAddress)` entries**
- [ ] **Step 2: Run `pnpm db:generate` and `pnpm db:validate`**
- [ ] **Step 3: Write failing service tests for live score, active rate, tie order, pagination, distance, and a twice-run finalizer producing one archive**
- [ ] **Step 4: Run `pnpm test api/leaderboardStore.test.ts` and verify missing implementation failures**
- [ ] **Step 5: Implement live aggregation from overlapping ledger entries and active states; call existing rate settlement at the exact boundary before archiving**
- [ ] **Step 6: Implement chronological overdue-period finalization and transactional `upsert` operations**
- [ ] **Step 7: Run `pnpm test api/leaderboardStore.test.ts api/planetIndexer.test.ts` and verify pass, including old-owner transfer accrual**

### Task 4: Public mining and leaderboard HTTP API

**Files:**
- Create: `api/leaderboardRoutes.ts`
- Create: `api/leaderboardRoutes.test.ts`
- Modify: `api/stage2.ts`
- Modify: `api/stage2.test.ts`
- Modify: `api/index.ts`
- Modify: `vite.config.ts`
- Modify: `vite.config.test.ts`

**Interfaces:**
- Exposes `GET /api/wallets/:address/mining`.
- Exposes the four `/api/leaderboard/*` routes from the approved design.

- [ ] **Step 1: Write failing route tests for valid responses plus invalid address, invalid period, bounded `limit`, and backend-unavailable errors**
- [ ] **Step 2: Run `pnpm test api/leaderboardRoutes.test.ts api/stage2.test.ts vite.config.test.ts` and verify route failures**
- [ ] **Step 3: Implement Zod validation, dependency injection, decimal strings, and explicit 400/404/503 responses**
- [ ] **Step 4: Mount `/api/wallets` and `/api/leaderboard` in the Vite development middleware**
- [ ] **Step 5: Run the focused route tests and verify pass**

### Task 5: Frontend data contracts and live display values

**Files:**
- Create: `src/hooks/useWalletMining.ts`
- Create: `src/hooks/useWalletMining.test.tsx`
- Create: `src/hooks/useLeaderboard.ts`
- Create: `src/hooks/useLeaderboard.test.tsx`
- Create: `src/lib/minerals.ts`
- Create: `src/lib/minerals.test.ts`

**Interfaces:**
- Produces `useWalletMining(address)` with a 30-second canonical refresh.
- Produces `useCurrentLeaderboard`, `useWalletLeaderboardPosition`, `useLeaderboardHistory`, and `useArchivedLeaderboard`.
- Produces `interpolateMinerals(snapshotMicros, effectivePerDayMicros, asOf, now)` and `formatMinerals(micros)`.

- [ ] **Step 1: Write failing exact bigint interpolation and formatting tests, including values beyond `Number.MAX_SAFE_INTEGER`**
- [ ] **Step 2: Run `pnpm test src/lib/minerals.test.ts` and verify missing module failure**
- [ ] **Step 3: Implement integer interpolation and string formatting without converting the authoritative quantity to `number`**
- [ ] **Step 4: Write failing hook tests for enabled state, query keys, 30-second refetch, response parsing, and HTTP errors**
- [ ] **Step 5: Implement direct endpoint fetchers and TanStack Query hooks without request waterfalls**
- [ ] **Step 6: Run the focused hook and utility tests and verify pass**

### Task 6: My Planets mining integration

**Files:**
- Modify: `src/pages/Planets.tsx`
- Modify: `src/pages/Planets.test.tsx`
- Modify: `src/components/planets/PlanetInventoryCard.tsx`
- Modify: `src/components/planets/PlanetInventoryCard.test.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.test.tsx`
- Create: `src/components/planets/LiveMineralAmount.tsx`
- Create: `src/components/planets/LiveMineralAmount.test.tsx`

**Interfaces:**
- Consumes the wallet snapshot and token-ID map from Task 5.
- Revealed cards receive optional effective-rate strings; unrevealed cards receive none.

- [ ] **Step 1: Write failing tests proving canonical total/effective rate display, selected Planet bonus details, graceful mining errors, and zero mining disclosure for unrevealed tickets**
- [ ] **Step 2: Run the focused Planet tests and verify the new expectations fail**
- [ ] **Step 3: Implement an isolated one-second `LiveMineralAmount` tick that respects reduced motion and does not rerender artwork**
- [ ] **Step 4: Map backend Planet mining rows by token ID and render earned, base, bonus, and effective rate only for revealed Planets**
- [ ] **Step 5: Run the focused Planet tests and verify pass**

### Task 7: Responsive weekly leaderboard page

**Files:**
- Modify: `src/pages/Leaderboard.tsx`
- Create: `src/pages/Leaderboard.test.tsx`
- Create: `src/components/leaderboard/WeekProgress.tsx`
- Create: `src/components/leaderboard/LeaderboardTable.tsx`
- Create: `src/components/leaderboard/WalletRankCard.tsx`

**Interfaces:**
- Consumes Task 5 leaderboard hooks.
- Keeps the existing `/leaderboard` route and navigation contract.

- [ ] **Step 1: Write failing tests for public standings, connected-wallet highlight, outside-page wallet card, countdown, history selection, empty state, and retryable backend error**
- [ ] **Step 2: Run `pnpm test src/pages/Leaderboard.test.tsx` and verify placeholder-page failures**
- [ ] **Step 3: Implement the HUD-aligned page with an orbital week-progress signature, compact data table, and sticky personal-rank card**
- [ ] **Step 4: Add mobile row cards below the table breakpoint so columns are not squeezed horizontally**
- [ ] **Step 5: Add accessible labels, keyboard states, and reduced-motion behavior**
- [ ] **Step 6: Run the focused page tests and verify pass**

### Task 8: Remove obsolete mineral asset concepts and verify the stage

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/GAME_IMPLEMENTATION_PLAN.md`
- Modify: `docs/PRODUCT_SPEC.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `src/components/planets/PlanetInventoryDetail.test.tsx`

- [ ] **Step 1: Remove obsolete mineral asset, balance, conversion, and withdrawal language; preserve every Megapot winnings-claim reference**
- [ ] **Step 2: Search docs and source for obsolete mineral asset lifecycle language and confirm none remains**
- [ ] **Step 3: Run `pnpm lint`**
- [ ] **Step 4: Run `pnpm typecheck`**
- [ ] **Step 5: Run `pnpm test`**
- [ ] **Step 6: Run `pnpm build`**
- [ ] **Step 7: Launch `pnpm dev --host 127.0.0.1` and verify `/my-planets` and `/leaderboard` at desktop and mobile widths**
- [ ] **Step 8: Confirm no horizontal overflow, no console errors, correct loading/empty/error states, and leave the site running**

## Self-review

- Spec coverage: backend authority, wallet aggregation, weekly live score,
  archive/finalization, four public endpoints, My Planets integration,
  responsive leaderboard, asset-lifecycle removal, and browser verification are mapped.
- Placeholder scan: no deferred implementation markers remain.
- Type consistency: all mineral quantities cross the API as decimal strings and
  are parsed to bigint only in calculation/formatting utilities.
- Worktree safety: implementation files already modified by the user are edited
  in place and are not committed with unrelated changes.
