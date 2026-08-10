# Expedition Success Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Play page's post-purchase grid and reveal dialog with Paper-matched ticket and NFT success screens driven by confirmed transaction receipts.

**Architecture:** Keep purchase receipt decoding and the existing voucher-backed `mint` / `mintBatch` writes intact. `Play` renders an expedition-complete screen once `confirmedTickets` exist, passes the actual mint action into its Reveal button, and switches to a reveal-complete screen only through the existing mint components' `onMinted` receipt callbacks.

**Tech Stack:** React, TypeScript, Tailwind CSS, wagmi, viem, Vitest, Testing Library.

## Global Constraints

- Preserve `MEGAPLANETS_V1`, dynamic ticket price/bounds, exact USDC approval, receipt decoding, and Base Sepolia wallet flow.
- A successful screen must never appear before `useWaitForTransactionReceipt(...).isSuccess`.
- Do not introduce a fictitious on-chain claim action; the visual `Claim` control is presentational until a planet-claim protocol is specified.
- Keep source code and identifiers in English; Paper copy remains English.

---

### Task 1: Add receipt-driven success-screen components

**Files:**
- Create: `src/components/explore/ExpeditionCompleteScreen.tsx`
- Create: `src/components/explore/RevealCompleteScreen.tsx`
- Create: `src/components/explore/ExpeditionSuccessScreens.test.tsx`

**Interfaces:**
- Consumes: `PlanetPreview` and a `ReactNode` reveal action.
- Produces: `ExpeditionCompleteScreen({ count, revealAction })` and `RevealCompleteScreen({ planets, drawingId, onViewPlanets })`.

- [ ] **Step 1: Write failing screen tests**

```tsx
expect(screen.getByText('EXPEDITION COMPLETE')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'REVEAL (3)' })).toBeInTheDocument();
expect(screen.getByText('REVEAL COMPLETE')).toBeInTheDocument();
expect(screen.getAllByRole('img', { name: /revealed planet/i })).toHaveLength(3);
```

- [ ] **Step 2: Run the focused test and verify the imports fail**

Run: `pnpm test src/components/explore/ExpeditionSuccessScreens.test.tsx`

- [ ] **Step 3: Implement static Paper layouts**

```tsx
export function ExpeditionCompleteScreen({ count, revealAction }: Props) {
  return <section><p>EXPEDITION COMPLETE</p><h1>You found {count} planets!</h1>{revealAction}</section>;
}
```

Use overlapping question-mark circles for tickets and pixel previews plus trait/name labels for revealed cards. Render at most three featured cards, preserving responsive layout.

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm test src/components/explore/ExpeditionSuccessScreens.test.tsx`

### Task 2: Wire success screens to confirmed purchase and mint receipts

**Files:**
- Modify: `src/pages/Play.tsx`
- Modify: `src/pages/Play.test.tsx`
- Modify: `src/components/planets/MintPlanetButton.tsx`
- Modify: `src/components/planets/MintPlanetBatchButton.tsx`

**Interfaces:**
- Consumes: receipt callbacks already exposed as `onMinted`.
- Produces: a Play-local successful-reveal state and custom trigger labels `REVEAL (n)`.

- [ ] **Step 1: Write failing Play flow tests**

```tsx
expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
expect(screen.getByText('EXPEDITION COMPLETE')).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify the old dialog assertion fails**

Run: `pnpm test src/pages/Play.test.tsx`

- [ ] **Step 3: Replace `PlanetsFoundGrid` and `RevealDialog`**

Use a local `revealedTicketIds` set in `Play`. Pass `onMinted` to the single or batch mint button; set this state only from the existing receipt-success callbacks. Render `RevealCompleteScreen` when the set contains the just-minted tickets. Preserve unavailable-voucher and transaction-error output within the expedition-complete screen.

- [ ] **Step 4: Re-run focused tests**

Run: `pnpm test src/pages/Play.test.tsx src/components/planets/MintPlanetButton.test.tsx src/components/planets/MintPlanetBatchButton.test.tsx`

### Task 3: Validate the browser behavior and project checks

**Files:**
- Verify only.

- [ ] **Step 1: Check `/play` visually**

Confirm the first screen has `EXPEDITION COMPLETE`, featured unknown tickets, and a direct `REVEAL (n)` control with no modal.

- [ ] **Step 2: Confirm the receipt callback gate**

Confirm `REVEAL COMPLETE` is rendered only via `onMinted`, not when the reveal button is pressed.

- [ ] **Step 3: Run required verification**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
