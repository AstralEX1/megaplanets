# My Planets Ticket Status Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add approve-once allowance behavior, fixed Play coordinate disclosure, real per-ticket statuses and claims, mineral iconography, rarity borders, unrevealed coordinate selection, and animated selected-planet art.

**Architecture:** Keep `Planets` as the composition boundary and add one dedicated `usePlanetTicketStatuses` hook. The hook combines existing RPC drawing states with existing wallet ticket history and returns a stable map keyed by on-chain ticket ID; components render the view model and the page owns the existing claim transaction. Reuse the generator GIF worker through a focused `PlanetGif` component.

**Tech Stack:** React, TypeScript, wagmi, TanStack Query, viem, Tailwind CSS, Vitest, Testing Library, Vite.

## Global Constraints

- Target the repository's configured Base Sepolia contracts.
- Do not rewrite purchase, mint, claim, indexer, generator, or backend logic.
- Keep `MEGAPLANETS_V1`, receipt confirmation, bigint handling, and route-specific approval spenders.
- Never expose generated traits or visuals for unrevealed tickets.
- Use pnpm and run lint, typecheck, test, and build before completion.
- Launch the site after completion and verify desktop and mobile layouts.

---

### Task 1: Approve-once allowance gate

**Files:**
- Create: `src/components/common/ApprovalButton.test.tsx`
- Modify: `src/components/common/ApprovalButton.tsx`

**Interfaces:**
- Consumes: required purchase `amount`, route-specific `spender`, and `useUsdcAllowance`.
- Produces: children when allowance is sufficient; otherwise a single `Approve USDC once` transaction using `maxUint256`.

- [ ] Write component tests that resolve allowance below and above the required amount and assert that approval is hidden when sufficient.
- [ ] Write a test that clicks `Approve USDC once` and expects `approve(spender, maxUint256)`.
- [ ] Run `pnpm test -- src/components/common/ApprovalButton.test.tsx` and confirm the new assertions fail against exact-amount approval.
- [ ] Replace only the approval transaction amount and copy; retain the existing allowance comparison, loading/error states, receipt refetch, and spender prop.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Fixed coordinates disclosure

**Files:**
- Modify: `src/components/explore/ExpeditionConfigurator.test.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`

**Interfaces:**
- Consumes: existing coordinate open state and `CoordinatesPanel`.
- Produces: a fixed desktop center column plus an independently disclosed right column; mobile remains inline.

- [ ] Add a failing assertion for a stable desktop center anchor and a right-side disclosure region.
- [ ] Run the focused configurator test and observe the missing stable layout marker.
- [ ] Replace the recentering flex row with a desktop grid whose center column remains `560px` and whose right column owns the arrow plus `430px` panel.
- [ ] Re-run the focused test.

### Task 3: Ticket status view model and hook

**Files:**
- Create: `src/hooks/usePlanetTicketStatuses.ts`
- Create: `src/hooks/usePlanetTicketStatuses.test.tsx`
- Modify: `src/hooks/useWalletTickets.ts`

**Interfaces:**
- Consumes: `{ ticketId, drawingId }[]`, live Jackpot `{ drawingId, phase, drawingTime }`, `usePlanetDrawingStates`, and `useWalletTickets`.
- Produces: `Map<string, PlanetTicketStatus>` where `PlanetTicketStatus` is one of `countdown`, `drawing`, `claim`, `claimed`, `drawn`, or `unavailable`; plus loading, error, and `refetch`.

- [ ] Write failing tests for countdown formatting, drawing-in-progress, losing settled ticket, claimable amount, claimed amount, and unknown historical data.
- [ ] Run the focused hook test and confirm the module/status mapping is absent.
- [ ] Expose the already-fetched flat `tickets` array from `useWalletTickets`.
- [ ] Implement a pure `derivePlanetTicketStatus` helper and a hook that indexes API tickets by `user_ticket_id`, updates countdowns once per second only when needed, and never labels missing settled API data as `Drawn`.
- [ ] Re-run the focused test.

### Task 4: Mineral icon, status cards, and unrevealed selection

**Files:**
- Add: `src/assets/mineral-icon.png`
- Modify: `src/components/planets/PlanetInventoryCard.test.tsx`
- Modify: `src/components/planets/PlanetInventoryCard.tsx`
- Modify: `src/pages/Planets.test.tsx`
- Modify: `src/pages/Planets.tsx`

**Interfaces:**
- Consumes: the ticket status map and existing rarity classes.
- Produces: compact clickable cards with mineral icon/status rows and selected unrevealed coordinate detail.

- [ ] Add failing card tests for mineral icon, right-aligned status, rarity border, selected state, and separated Mint action.
- [ ] Add a failing page test proving an unrevealed card can be selected and its exact ticket coordinates appear without generated traits.
- [ ] Run the focused card/page tests and confirm failures.
- [ ] Copy the supplied mineral PNG into assets and render it with accessible text while removing `minerals/day` copy.
- [ ] Make the unrevealed artwork area/card selection control clickable, keep Mint stop-propagated/separate, and pass ticket status into every card.
- [ ] Replace direct drawing-state composition in `Planets` with `usePlanetTicketStatuses` while preserving stable selection through sorting.
- [ ] Re-run the focused tests.

### Task 5: Animated detail and real claim action

**Files:**
- Create: `src/components/planets/PlanetGif.tsx`
- Create: `src/components/planets/PlanetGif.test.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.test.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.tsx`
- Modify: `src/pages/Planets.test.tsx`
- Modify: `src/pages/Planets.tsx`

**Interfaces:**
- Consumes: `PlanetPreview`, `PlanetTicketStatus`, `useClaimWinnings`, and status `refetch`.
- Produces: animated revealed artwork; coordinates-only unrevealed detail; primary lifecycle action whose `claim` state submits the selected ticket ID.

- [ ] Add failing tests for GIF loading fallback/ready image, clock icon with bare time, `Claim ($X)`, `Claimed ($X)`, `Drawn`, and claim callback arguments.
- [ ] Run the focused tests and confirm the missing behavior.
- [ ] Extract the Lab worker/object-URL lifecycle into `PlanetGif`, preserving pixelated rendering and static fallback.
- [ ] Update detail presentation and add a real claim callback only for `status.kind === 'claim'`.
- [ ] On receipt success, refetch status data and reset the existing claim hook.
- [ ] Re-run focused tests.

### Task 6: Verification and browser launch

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed tasks.
- Produces: verified build and observable desktop/mobile behavior at `/play` and `/my-planets`.

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Launch/restart the Vite site and open `/my-planets`.
- [ ] Verify desktop Play coordinate disclosure does not move the central controls.
- [ ] Verify desktop My Planets card/detail selection and mobile collection/detail navigation.
- [ ] Review `git diff` for unrelated edits and privacy leaks.

