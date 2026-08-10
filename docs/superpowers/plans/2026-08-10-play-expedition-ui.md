# Play Expedition UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the supplied Paper desktop expedition UI and React Bits TargetCursor without changing Megapot purchase semantics.

**Architecture:** Keep `Play.tsx` as the purchase orchestrator and make the existing `ExpeditionConfigurator` the responsive visual composition. A range input remains the quantity source of truth, while a presentational desktop panel composes the existing coordinate-editing controls. TargetCursor is a global desktop-only layer that observes explicitly marked interactive targets.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, wagmi, viem, pnpm, GSAP, Vitest.

## Global Constraints

- Preserve dynamically read drawing state, ticket bounds, price, exact USDC approvals, confirmation, direct purchase, and bulk purchase implementations.
- Initial quantity is 3; the new visible quantity range is 1 through 50 with labels 1, 10, 25, and 50.
- Keep source code and UI copy in English.
- Coordinates are closed by default and the desktop panel toggles with the arrow; touch interaction must retain native controls.
- The custom cursor is decorative, desktop-only, pointer-events-free, and honors reduced motion.
- Do not overwrite unrelated working-tree changes.

---

### Task 1: Add a testable 1--50 range control

**Files:**
- Modify: `src/components/explore/CompactPlanetDial.tsx`
- Create: `src/components/explore/CompactPlanetDial.test.tsx`

**Interfaces:**
- Consumes: `quantity: number`, `onChange(value: number): void`.
- Produces: a range input labelled `Planets to explore` with `min=1`, `max=50`, and accessible slider changes.

- [ ] **Step 1: Write the failing test.**

```tsx
it('limits the expedition slider to 1 through 50', () => {
  render(<CompactPlanetDial quantity={3} onChange={onChange} />);
  const slider = screen.getByRole('slider', { name: 'Planets to explore' });
  expect(slider).toHaveAttribute('min', '1');
  expect(slider).toHaveAttribute('max', '50');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because the current maximum is 100.**

Run: `pnpm test -- CompactPlanetDial.test.tsx`

- [ ] **Step 3: Implement the Paper slider presentation.**

Set `MAX` to `50`, replace the semicircle with the horizontal track/handle treatment, use marker labels `[1, 10, 25, 50]`, retain a native range input, and add `cursor-target`.

- [ ] **Step 4: Run the focused test and confirm it passes.**

Run: `pnpm test -- CompactPlanetDial.test.tsx`

### Task 2: Compose the collapsible Paper coordinates panel

**Files:**
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`
- Modify: `src/components/explore/CoordinatesDisclosure.tsx`
- Modify: `src/components/explore/ManualTicketRow.tsx`
- Create: `src/components/explore/ExpeditionConfigurator.test.tsx`

**Interfaces:**
- Consumes: existing configurator props, including `onTicketsChange` and `onAutomaticQuickPickChange`.
- Produces: a default-closed `Coordinates` desktop panel controlled by a labelled toggle and using existing ticket-picker callbacks.

- [ ] **Step 1: Write the failing interaction test.**

```tsx
it('opens and closes coordinates from the desktop arrow', async () => {
  const user = userEvent.setup();
  render(<ExpeditionConfigurator {...props} />);
  const toggle = screen.getByRole('button', { name: 'Open coordinates' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  expect(screen.getByRole('region', { name: 'Coordinates' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close coordinates' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails because no desktop panel toggle exists.**

Run: `pnpm test -- ExpeditionConfigurator.test.tsx`

- [ ] **Step 3: Implement the responsive composition from the Paper source.**

Keep the three `?` planet silhouettes and dynamic drawing banner in the configurator. Add local `coordinatesOpen` state, a desktop panel wrapper that transitions width/opacity, and the labelled arrow control. Move the existing coordinate content into a reusable panel body rather than duplicating ticket state. Render the panel only within the existing configuration surface; use the original ticket rows and `TicketPicker` callbacks.

- [ ] **Step 4: Connect active Paper controls.**

Make `SHUFFLE` replace each manual row with `randomTicket(bounds)`; ticket rows open their existing picker; preserve add/remove and quick-pick controls. Mark buttons, the coordinates toggle, and editable rows with `cursor-target`.

- [ ] **Step 5: Run the focused test and verify its assertions pass.**

Run: `pnpm test -- ExpeditionConfigurator.test.tsx`

### Task 3: Preserve checkout state with the new starting quantity

**Files:**
- Modify: `src/pages/Play.tsx`
- Modify: `src/components/explore/ExploreButton.tsx`

**Interfaces:**
- Consumes: `useJackpotState()`, `totalCost`, direct/bulk purchase hooks.
- Produces: a value of `3` on first render and a labelled button showing the exact formatted `total` bigint.

- [ ] **Step 1: Update the presentation defaults.**

Initialize `count` and `selectedPreset` at 3/custom; clamp `setQuantity` to 1--50 while keeping the existing static-ticket cleanup and direct purchase path.

- [ ] **Step 2: Align button copy with the Paper design.**

Keep the `UsdcAmount` formatter and label the action `EXPLORE {quantity} · {total} USDC`; retain its disabled state and confirmation callback unchanged.

- [ ] **Step 3: Type-check this purchase boundary.**

Run: `pnpm typecheck`

### Task 4: Add the desktop TargetCursor

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/components/common/TargetCursor.tsx`
- Create: `src/components/common/TargetCursor.css`
- Modify: `src/components/layout/Layout.tsx`

**Interfaces:**
- Consumes: `TargetCursor` props `targetSelector`, `spinDuration`, `hideDefaultCursor`, `parallaxOn`, colors.
- Produces: an optional fixed cursor layer for `.cursor-target` elements, with no DOM output on touch or reduced-motion environments.

- [ ] **Step 1: Add GSAP using pnpm.**

Run: `pnpm add gsap`

- [ ] **Step 2: Add a typed React implementation based on the supplied React Bits source.**

Convert the supplied JSX refs and DOM values to TypeScript, keep its containing-block compensation and cleanup behavior, and use the supplied CSS under scoped `target-cursor-*` class names.

- [ ] **Step 3: Gate animation by media capability.**

Render nothing when `(pointer: coarse)` or `prefers-reduced-motion: reduce` matches; otherwise mount it once in `Layout` with `targetSelector=".cursor-target"`, `spinDuration={2}`, and the project lavender/white palette.

- [ ] **Step 4: Type-check the cursor integration.**

Run: `pnpm typecheck`

### Task 5: Verify the integrated flow

**Files:**
- Modify only if a test or verification identifies a defect in the files above.

- [ ] **Step 1: Run focused component tests.**

Run: `pnpm test -- CompactPlanetDial.test.tsx ExpeditionConfigurator.test.tsx`

- [ ] **Step 2: Run required repository verification.**

Run: `pnpm lint; pnpm typecheck; pnpm test; pnpm build`

- [ ] **Step 3: Browser-smoke the local Play screen.**

Verify the initial quantity is 3, moving the slider updates the action total, the desktop arrow opens/closes coordinates, Shuffle changes rows, and Explore reaches confirmation without starting a transaction.

- [ ] **Step 4: Review the final diff.**

Run: `git diff --check; git diff -- src/pages/Play.tsx src/components/explore src/components/common/TargetCursor.tsx src/components/common/TargetCursor.css src/components/layout/Layout.tsx package.json pnpm-lock.yaml`
