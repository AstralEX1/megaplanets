# Play And My Planets Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Play purchase configurator and My Planets inventory while making Base Sepolia ticket statuses reliable without changing working purchase, mint, or claim transactions.

**Architecture:** Keep the Play core centered independently from a desktop-only right coordinate drawer, and add presentational animations through focused components with reduced-motion support. Replace the Data-API-only settled-ticket dependency with an RPC-first status reader, using the Data API as enrichment when it has matching history. Compact the selected-planet panel and strengthen rarity presentation without exposing unrevealed traits.

**Tech Stack:** React, TypeScript, wagmi, viem, TanStack Query, Tailwind CSS, Vitest, Testing Library, Playwright/browser smoke checks.

## Global Constraints

- Use pnpm and preserve existing TypeScript, React, wagmi, viem, Tailwind, and Biome conventions.
- Target Base Sepolia and keep `TICKET_SOURCE` equal to `MEGAPLANETS_V1`.
- Do not rewrite purchase, approval, mint, claim, backend, or blockchain transaction logic.
- Keep unrevealed planet names, art, rarity, minerals, and deterministic traits private.
- Show real coordinates only when known; automatic quick-pick rows must not invent coordinates before purchase.
- Respect `prefers-reduced-motion` for all new motion.
- Remove the disclaimer globally.
- Required final verification: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`, followed by desktop and mobile browser checks and a running local site.

---

### Task 1: RPC-first planet ticket statuses

**Files:**
- Modify: `src/hooks/usePlanetDrawingStates.ts`
- Modify: `src/hooks/usePlanetTicketStatuses.ts`
- Modify: `src/hooks/usePlanetDrawingStates.test.tsx`
- Modify: `src/hooks/usePlanetTicketStatuses.test.ts`

**Interfaces:**
- Consumes: `PlanetTicketRef`, current jackpot lifecycle state, wallet-ticket Data API records, Jackpot drawing state, ticket tier reads, and payout calculator reads.
- Produces: `PlanetTicketStatus` values `countdown`, `drawing`, `claim`, `claimed`, `drawn`, or `unavailable`, with settled Base Sepolia tickets resolved without requiring a Data API row.

- [ ] **Step 1: Add failing derivation and hook tests**

Cover settled losing tickets returning `drawn`, settled winning tickets returning `claim` with their raw USDC amount, claimed API history overriding the RPC fallback, and genuine read failures returning `unavailable`.

- [ ] **Step 2: Run focused status tests and confirm the new cases fail**

Run: `pnpm test -- src/hooks/usePlanetTicketStatuses.test.ts src/hooks/usePlanetDrawingStates.test.tsx`

Expected: FAIL because settled RPC results currently contain lifecycle only and fall through to `unavailable`.

- [ ] **Step 3: Extend the read model and status derivation**

Batch reads by unique drawing/ticket, retain bigint values until formatting, derive the ticket tier using the canonical Jackpot read, derive the corresponding payout using that drawing's payout calculator inputs, and use API `claimed` data when available. Do not make a failed API lookup erase a successful on-chain result.

- [ ] **Step 4: Run focused status tests**

Run: `pnpm test -- src/hooks/usePlanetTicketStatuses.test.ts src/hooks/usePlanetDrawingStates.test.tsx`

Expected: PASS.

### Task 2: DepthText jackpot headline and centered Play layout

**Files:**
- Create: `src/components/common/DepthText.tsx`
- Create: `src/components/common/DepthText.css`
- Create: `src/components/common/DepthText.test.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.test.tsx`
- Modify: `src/pages/Play.tsx`

**Interfaces:**
- Consumes: raw current jackpot `prizePool`, current quantity, and existing coordinate disclosure state.
- Produces: a React Bits-derived `DepthText` heading reading `Win up to $X` and a desktop layout whose main core keeps the same viewport center before and after the coordinate panel opens.

- [ ] **Step 1: Add failing headline and layout tests**

Assert formatted jackpot copy is passed into the configurator, the heading is rendered accessibly as text, and the coordinate drawer remains a right-side sibling/overlay rather than a grid column that reserves horizontal space.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm test -- src/components/common/DepthText.test.tsx src/components/explore/ExpeditionConfigurator.test.tsx`

Expected: FAIL because `DepthText` and jackpot headline props do not exist.

- [ ] **Step 3: Adapt the supplied React Bits component and layout**

Convert the supplied JavaScript component to typed React, preserve pointer tracking and reduced-motion behavior, and keep it dependency-free. Center the `560px` core in the page; position the desktop drawer and toggle to its right without translating or resizing the core. Keep the mobile disclosure inline.

- [ ] **Step 4: Run focused tests**

Run: `pnpm test -- src/components/common/DepthText.test.tsx src/components/explore/ExpeditionConfigurator.test.tsx`

Expected: PASS.

### Task 3: Quantity and coordinate ticket animations

**Files:**
- Modify: `src/components/explore/StaticDepthStack.tsx`
- Create: `src/components/explore/StaticDepthStack.test.tsx`
- Modify: `src/components/explore/CoordinatesDisclosure.tsx`
- Modify: `src/components/explore/CoordinatesDisclosure.test.tsx`
- Modify: `src/components/explore/ManualTicketRow.tsx`

**Interfaces:**
- Consumes: `quantity`, known manual tickets, automatic quick-pick count, and ticket bounds.
- Produces: keyed enter/exit animations for planet visuals and ticket rows; automatic rows render as labelled placeholders until the purchase supplies real coordinates.

- [ ] **Step 1: Add failing animation and privacy tests**

Assert one visual slot per visible selected planet, one row per selected ticket, known manual coordinates rendered as numbered balls, automatic rows labelled `Quick pick`, and no fabricated coordinate numbers.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm test -- src/components/explore/StaticDepthStack.test.tsx src/components/explore/CoordinatesDisclosure.test.tsx`

Expected: FAIL because automatic ticket slots and animation states are absent.

- [ ] **Step 3: Add CSS-driven enter/exit motion**

Use stable positional keys, staggered delays, transform/opacity transitions, and reduced-motion overrides. Style tickets with compact numbered balls and a separated bonus ball while retaining MegaPlanets color tokens.

- [ ] **Step 4: Run focused tests**

Run: `pnpm test -- src/components/explore/StaticDepthStack.test.tsx src/components/explore/CoordinatesDisclosure.test.tsx`

Expected: PASS.

### Task 4: Approval copy and global disclaimer removal

**Files:**
- Modify: `src/components/common/ApprovalButton.tsx`
- Modify: `src/components/common/ApprovalButton.test.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Modify: `src/components/layout/Layout.test.tsx`

**Interfaces:**
- Consumes: existing allowance-first approval flow and shared Layout.
- Produces: button copy `Approve USDC` and no global disclaimer/footer rendering.

- [ ] **Step 1: Update tests to require the new copy and absent footer**

Assert approval behavior is unchanged while the label is exactly `Approve USDC`, and assert Layout no longer renders disclaimer text or its link.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm test -- src/components/common/ApprovalButton.test.tsx src/components/layout/Layout.test.tsx`

Expected: FAIL against the old copy and footer.

- [ ] **Step 3: Apply the minimal presentation changes**

Change only approval copy and remove `<Footer />` plus its unused import from Layout. Leave allowance checks and transaction calls untouched.

- [ ] **Step 4: Run focused tests**

Run: `pnpm test -- src/components/common/ApprovalButton.test.tsx src/components/layout/Layout.test.tsx`

Expected: PASS.

### Task 5: Elevated rarity cards and viewport-contained details

**Files:**
- Modify: `src/components/planets/PlanetInventoryCard.tsx`
- Modify: `src/components/planets/PlanetInventoryCard.test.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.test.tsx`
- Modify: `src/pages/Planets.tsx`
- Modify: `src/pages/Planets.test.tsx`

**Interfaces:**
- Consumes: existing rarity token classes, selection state, responsive master/detail layout, and unrevealed privacy state.
- Produces: a stronger rarity border/glow, elevated hover/selected treatment, and a compact sticky detail panel whose essential content fits ordinary desktop/laptop viewports with internal overflow only as a short-screen fallback.

- [ ] **Step 1: Add failing presentation contract tests**

Assert rarity remains represented by the card border, selection has a separate ring, revealed details keep the GIF and complete traits/ticket coordinates, unrevealed details expose no deterministic traits, and the desktop aside has viewport-bounded overflow styling.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm test -- src/components/planets/PlanetInventoryCard.test.tsx src/components/planets/PlanetInventoryDetail.test.tsx src/pages/Planets.test.tsx`

Expected: FAIL against the weaker border/elevation and unbounded detail panel.

- [ ] **Step 3: Implement the compact elevated design**

Strengthen the rarity-colored edge and glow, add hover elevation without conflicting with selection, reduce and clamp detail artwork height, tighten vertical spacing, use a denser trait grid, and add `max-height: calc(100vh - header offset)` with panel-local overflow as fallback.

- [ ] **Step 4: Run focused tests**

Run: `pnpm test -- src/components/planets/PlanetInventoryCard.test.tsx src/components/planets/PlanetInventoryDetail.test.tsx src/pages/Planets.test.tsx`

Expected: PASS.

### Task 6: Full verification and browser QA

**Files:**
- Modify only if verification exposes a scoped regression.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified desktop/mobile behavior and a running local development site.

- [ ] **Step 1: Run repository verification**

Run: `pnpm lint`

Run: `pnpm typecheck`

Run: `pnpm test`

Run: `pnpm build`

Expected: every command exits successfully.

- [ ] **Step 2: Launch the site**

Run the existing Vite development command on `127.0.0.1:5180`, reusing or replacing only the project dev process bound to that port.

- [ ] **Step 3: Verify desktop behavior**

At a desktop viewport, confirm the main Play core retains the same center coordinate before/after opening coordinates, quantity changes animate planet and ticket additions, jackpot copy is current, disclaimer is absent, rarity elevation is visible, and selected details are readable without page-bottom scrolling.

- [ ] **Step 4: Verify mobile behavior**

At a mobile viewport, confirm the Play core remains primary, coordinates open inline, My Planets remains collection-first, tapping a planet opens details, unrevealed privacy remains intact, and no horizontal overflow appears.

- [ ] **Step 5: Report limitations precisely**

Separate automated verification, disconnected-wallet browser verification, read-only RPC verification, and any connected-wallet or claim flow that could not be exercised without a transaction.
