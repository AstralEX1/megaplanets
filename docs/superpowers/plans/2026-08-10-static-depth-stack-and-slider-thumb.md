# Static Depth Stack and Slider Thumb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show selected expedition quantity with the supplied planet artwork in a non-interactive depth stack and replace the invisible native range thumb with a visible draggable slider thumb.

**Architecture:** `CompactPlanetDial` remains quantity input and emits a clamped integer through its current callback. It changes from a transparent native range to an accessible custom slider track with a concrete thumb. A static adaptation of React Bits DepthCarousel renders repeated supplied planet-image cards based on `quantity`; it has no arrows, wheel, keyboard navigation, autoplay, or card drag.

**Tech Stack:** React 19, TypeScript, CSS, GSAP, Vitest, Testing Library, pnpm.

## Global Constraints

- Quantity stays the sole source of truth in `Play` and remains clamped to 1–50.
- The static card stack cannot change quantity or trigger a purchase.
- Preserve the direct/bulk purchase branches and exact-amount approval gate.
- Use the user-supplied PNG as a local project asset.

---

### Task 1: Implement a real slider thumb

**Files:**
- Modify: `src/components/explore/CompactPlanetDial.tsx`
- Modify: `src/components/explore/CompactPlanetDial.test.tsx`

- [ ] Write a failing test that asserts an element named `Selected planets thumb` is positioned from the current quantity and that pointer/keyboard interactions emit the expected clamped quantity.
- [ ] Run the focused test and confirm the existing native range lacks the thumb element.
- [ ] Replace the native `input[type=range]` overlay with a `role=slider` track and an explicit thumb button; use pointer capture and Arrow/Home/End keys to update the parent callback.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Add static DepthCarousel planet visualization

**Files:**
- Create: `src/assets/unrevealed-planet.png`
- Create: `src/components/explore/StaticDepthStack.tsx`
- Create: `src/components/explore/StaticDepthStack.css`
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.test.tsx`

- [ ] Copy the supplied PNG into `src/assets/` without altering it.
- [ ] Write a failing test that renders a labelled static stack with `quantity` cards and no carousel navigation controls.
- [ ] Adapt the supplied React Bits depth layout to a presentation-only component: cards receive static depth transforms and tint, reduce-motion disables visual transitions, and no event handlers alter focus/card order.
- [ ] Replace `PlanetSilhouettes` with `StaticDepthStack` in the configurator.
- [ ] Re-run the focused test and confirm it passes.

### Task 3: Restore GSAP and verify

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Install `gsap` using the project-local pnpm store because the React Bits component depends on it.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [ ] Smoke-test `/play`: drag/click the visible thumb, use Custom input, and confirm the card stack changes count without carousel controls. Do not connect a wallet or submit a transaction.
