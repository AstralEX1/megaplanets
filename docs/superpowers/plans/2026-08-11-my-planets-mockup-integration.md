# My Planets Mockup Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the interactive `/my-planets` inventory from the supplied mockup while preserving the existing wallet, ticket, mint, indexer, generator, and drawing integrations.

**Architecture:** Keep `Planets` as the composition boundary and introduce small pure view-model helpers for ordering, identifiers, mineral totals, rarity colors, and cycle labels. Extend the existing URL-aware app shell without adding a router dependency, and reuse the selected detail component for `/planet/:id` plus mobile full-page detail.

**Tech Stack:** React, TypeScript, wagmi, TanStack Query, Tailwind CSS, Vitest, Testing Library, Playwright.

## Global Constraints

- Do not change blockchain writes, voucher preparation, ticket provenance, indexer behavior, or backend APIs.
- Unrevealed tickets remain private: no generated name, artwork, type, minerals, rarity, or deterministic traits.
- Revealed small cards show name, Planet ID, minerals/day, rarity through border color, and a separate selected state; no rarity badge.
- The detail primary action uses the existing live jackpot hook for the current drawing and historical API status for linked drawings.
- Preserve exact-amount approvals, Base Sepolia targeting, `MEGAPLANETS_V1`, and receipt-confirmed minting.

---

### Task 1: Inventory view model and tests

**Files:**
- Create: `src/lib/planetInventory.ts`
- Create: `src/lib/planetInventory.test.ts`
- Modify: `src/hooks/useIndexedPlanets.ts`

**Interfaces:**
- Consumes: revealed `PlanetPreview` values plus indexed `tokenId` and `mintedAt` metadata.
- Produces: stable `sortPlanetInventory`, `sumMineralsPerDay`, `rarityBorderClass`, and cycle-action labels.

- [ ] Write tests for Newest, Oldest, Minerals, Rarity, stable selection identifiers, mineral totals, rarity color mapping, and current/historical drawing labels.
- [ ] Run the focused test and confirm it fails because the view-model module does not exist.
- [ ] Implement the pure helpers and expose already-returned indexer fields in the frontend type.
- [ ] Run the focused test and confirm it passes.

### Task 2: Card and detail behavior

**Files:**
- Modify: `src/components/planets/PlanetInventoryCard.tsx`
- Modify: `src/components/planets/PlanetInventoryCard.test.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.tsx`
- Modify: `src/components/planets/PlanetInventoryDetail.test.tsx`

**Interfaces:**
- Consumes: selected inventory item metadata and cycle action callbacks.
- Produces: compact rarity-bordered cards and a trait/ticket detail panel with a large drawing action.

- [ ] Add failing component tests for Planet ID, rarity border, selected state, absence of a rarity badge, trait rows, separated bonus number, cycle action, and `/planet/:id` action.
- [ ] Implement the card/detail markup while preserving the unrevealed boundary.
- [ ] Re-run focused component tests.

### Task 3: Page state, sorting, routes, and responsive flow

**Files:**
- Modify: `src/pages/Planets.tsx`
- Modify: `src/pages/Planets.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Nav.tsx`
- Modify: `src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: existing wallet/ticket/indexed/drawing hooks and the current `NavKey` shell.
- Produces: canonical `/my-planets`, `/planets` compatibility, `/planet/:id`, stable sorting/selection, empty/disconnected states, and mobile full-page detail.

- [ ] Add failing page tests for totals, all sort choices, selection preservation, empty/disconnected actions, and details navigation.
- [ ] Implement stable inventory items and responsive collection/detail composition.
- [ ] Add History API synchronization for `/play`, `/my-planets`, `/leaderboard`, and `/planet/:id` without adding a router.
- [ ] Re-run focused page and shell tests.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` with the bundled Windows runtime if required.
- [ ] Inspect `/my-planets` and `/planet/:id` at desktop and mobile viewport widths, including disconnected and fixture-backed collection states where possible.
- [ ] Review the diff for privacy leaks, unrelated edits, and accidental blockchain/backend changes.
