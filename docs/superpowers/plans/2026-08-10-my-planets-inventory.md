# My Planets Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive Material 3-informed list-detail inventory that keeps unrevealed ticket traits hidden.

**Architecture:** Add a read-only drawing-status hook that fetches the distinct ticket drawing IDs from the existing Megapot Data API. Refactor `Planets` presentation around small inventory-card and detail components while retaining its ticket merge and mint receipt logic.

**Tech Stack:** React, TypeScript, Tailwind CSS, TanStack Query, Megapot Data API, wagmi, Vitest.

## Global Constraints

- Use the Data API only for historical `active` or `settled` round state; do not infer unavailable values.
- Preserve Base Sepolia mint preparation, simulation, wallet write, and receipt-confirmed `onMinted` state.
- Revealed cards show preview/name/type/minerals/state; unrevealed cards show only state and `Mint`.
- Keep card selection keyboard accessible and responsive across list-detail breakpoints.

---

### Task 1: Historical drawing-state read model

**Files:**
- Create: `src/hooks/usePlanetDrawingStates.ts`
- Create: `src/hooks/usePlanetDrawingStates.test.ts`

**Interfaces:**
- Consumes: `readonly bigint[]` ticket drawing IDs and `api.round`.
- Produces: `usePlanetDrawingStates(drawingIds): { states: ReadonlyMap<string, 'active' | 'settled'>; isLoading; error }`.

- [ ] **Step 1: Write a failing mapping test**

```tsx
expect(mapRoundStatus({ id: '218', status: 'settled' })).toEqual(['218', 'settled']);
```

- [ ] **Step 2: Run `pnpm test src/hooks/usePlanetDrawingStates.test.ts` and confirm the missing-module failure.**
- [ ] **Step 3: Implement a single TanStack query per unique drawing ID and preserve unavailable states as absent map values.**
- [ ] **Step 4: Run the focused test and confirm it passes.**

### Task 2: Inventory cards and details

**Files:**
- Create: `src/components/planets/PlanetInventoryCard.tsx`
- Create: `src/components/planets/PlanetInventoryDetail.tsx`
- Create: `src/components/planets/PlanetInventoryCard.test.tsx`

**Interfaces:**
- Consumes: `PlanetPreview`, `revealed`, `drawingStatus`, `selected`, and an optional mint action.
- Produces: a selectable card and detail presentation with privacy boundaries.

- [ ] **Step 1: Write failing tests that assert revealed cards expose name/type/minerals while unrevealed cards do not.**
- [ ] **Step 2: Run the focused test and confirm the missing-module failure.**
- [ ] **Step 3: Implement M3 stateful card surfaces and responsive detail sections.**
- [ ] **Step 4: Run the focused test and confirm it passes.**

### Task 3: Integrate the list-detail inventory page

**Files:**
- Modify: `src/pages/Planets.tsx`
- Modify: `src/pages/Planets.test.tsx` or create it if absent.

**Interfaces:**
- Consumes: existing ticket merge/index/mint state plus `usePlanetDrawingStates` and inventory components.
- Produces: a responsive My Planets page with selected detail.

- [ ] **Step 1: Write a failing page test for selected-card detail and an unrevealed Mint-only card.**
- [ ] **Step 2: Run the focused test and confirm its current gallery assertion fails.**
- [ ] **Step 3: Replace generic gallery markup with the list-detail composition without changing ticket or mint data sources.**
- [ ] **Step 4: Run focused page and component tests.**

### Task 4: Validate browser and repository checks

**Files:**
- Verify only.

- [ ] **Step 1: Inspect `/planets` in the browser at desktop and compact widths.**
- [ ] **Step 2: Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.**
