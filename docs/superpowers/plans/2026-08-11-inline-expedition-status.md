# Inline Expedition Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Play configurator visible during purchase, keep mystery planets visible during reveal, and show My Planets cards only after successful reveal.

**Architecture:** `Play` continues deriving canonical progress through `deriveExpeditionFlow`, but maps purchase scenes to the existing `ExpeditionConfigurator` and reveal scenes to `ExpeditionCompleteScreen`. `ExploreButton` accepts an optional status label, while receipt hooks remain mounted and unchanged.

**Tech Stack:** React, TypeScript, wagmi, Vitest, Testing Library, Biome.

## Global Constraints

- Do not change contract calls, voucher signing, receipt decoding, or indexer behavior.
- Results must render the existing `PlanetInventoryCard` component.
- Do not navigate away from the current presentation until the corresponding receipt succeeds.
- Keep source copy in English.

---

### Task 1: Inline purchase progress

**Files:**
- Modify: `src/components/explore/ExploreButton.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`
- Modify: `src/pages/Play.tsx`
- Test: `src/components/explore/ExpeditionConfigurator.test.tsx`
- Test: `src/pages/Play.test.tsx`

**Interfaces:**
- `ExploreButton` consumes optional `label?: ReactNode`.
- `ExpeditionConfigurator` forwards optional `exploreLabel?: ReactNode`.

- [ ] Write tests proving wallet/purchase/discovery state keeps the jackpot configurator visible and changes the button label.
- [ ] Run the focused tests and confirm they fail because Play currently renders `ExpeditionStatusScreen`.
- [ ] Route purchase scenes through `ExpeditionConfigurator` and map each scene to its button label.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Inline reveal progress

**Files:**
- Modify: `src/components/explore/ExpeditionSuccessScreens.tsx`
- Modify: `src/pages/Play.tsx`
- Test: `src/components/explore/ExpeditionSuccessScreens.test.tsx`
- Test: `src/pages/Play.test.tsx`

**Interfaces:**
- `MintPlanetButton` and `MintPlanetBatchButton` keep emitting their existing reveal state callbacks.
- `Play` keeps `ExpeditionCompleteScreen` mounted for `signals-located`, reveal confirmation, confirming reveal, and reveal errors.

- [ ] Write tests proving mystery planets remain visible while reveal is awaiting wallet/receipt confirmation.
- [ ] Write a test proving revealed results use `PlanetInventoryCard` only after `onMinted` receipt completion.
- [ ] Run the tests and confirm the current intermediate reveal screen fails them.
- [ ] Remove the coordinates explanation and keep the reveal action mounted on the mystery screen.
- [ ] Run the focused tests and confirm they pass.

### Task 3: Verification and launch

**Files:**
- Verify all modified frontend files.

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Verify desktop and mobile `/play` in the browser with no horizontal overflow or console errors.
- [ ] Leave `http://127.0.0.1:5180/play` running and open.
