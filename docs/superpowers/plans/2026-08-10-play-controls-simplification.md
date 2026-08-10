# Play Controls Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the Play purchase controls by removing the custom cursor and confirmation dialog, restoring immediate range updates, and adding Custom quantity input.

**Architecture:** `Play` remains the sole owner of quantity and purchase orchestration. `ExpeditionConfigurator` owns temporary Custom-input visibility, while `CompactPlanetDial` only emits numeric quantity changes. The existing direct and bulk purchase branches stay intact; the Explore callback invokes them directly.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, pnpm.

## Global Constraints

- Keep ticket quantity clamped to the existing inclusive range of 1 through 50.
- Preserve direct versus bulk purchase selection, exact USDC approval behavior, dynamic pricing, and ticket validation.
- Remove GSAP only if it has no remaining imports after cursor removal.
- Do not alter unrelated user changes in the dirty worktree.

---

### Task 1: Remove TargetCursor

**Files:**
- Modify: `src/components/layout/Layout.tsx`
- Delete: `src/components/common/TargetCursor.tsx`
- Delete: `src/components/common/TargetCursor.css`
- Delete: `src/components/common/TargetCursor.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Verify the cursor is mounted and GSAP is only used by it**

Run: `rg -n "TargetCursor|from 'gsap'|from \"gsap\"" src package.json`

Expected: `Layout.tsx` is the only mount point and `TargetCursor.tsx` is the only GSAP consumer.

- [ ] **Step 2: Remove the mount, source files, test, and unused GSAP dependency**

Remove the `TargetCursor` import and JSX from `Layout`. Delete the three cursor files, then run `pnpm remove gsap` through the bundled Windows pnpm runtime.

- [ ] **Step 3: Verify absence**

Run: `rg -n "TargetCursor|gsap" src package.json`

Expected: no matches.

### Task 2: Direct Explore launch without confirmation dialog

**Files:**
- Modify: `src/pages/Play.tsx`
- Test: `src/pages/Play.test.tsx` or existing focused Play test

**Interfaces:**
- Consumes: `ExpeditionConfigurator.onExplore(): void`.
- Produces: `launch(): void`, which chooses `bulk.createOrder()` or `direct.buy(...)` immediately.

- [ ] **Step 1: Write failing test**

```tsx
it('starts the direct purchase when Explore is clicked without rendering confirmation', async () => {
  // Render Play with a ready direct purchase hook and click Explore.
  // Expect the buy callback to receive count and bounds.
  // Expect screen.queryByRole('dialog', { name: /confirm expedition/i }) toBeNull().
});
```

- [ ] **Step 2: Run the focused test and verify it fails because Explore opens the summary state**

Run: `pnpm test src/pages/Play.test.tsx`

Expected: FAIL until the summary state and dialog are removed.

- [ ] **Step 3: Implement direct launch**

Remove `summaryOpen`, `SummaryDialog`, approval-dialog imports/props, and `Row`. Pass `launch` to `ExpeditionConfigurator.onExplore`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm test src/pages/Play.test.tsx`

Expected: PASS.

### Task 3: Working 1–50 dial and Custom input

**Files:**
- Modify: `src/components/explore/CompactPlanetDial.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`
- Modify: `src/components/explore/CompactPlanetDial.test.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.test.tsx`

**Interfaces:**
- Consumes: `quantity: number`, `onChange(value: number): void`.
- Produces: range `onInput` updates and Custom numeric input that applies valid clamped values.

- [ ] **Step 1: Write failing tests**

```tsx
it('emits the slider value while dragging', async () => {
  const onChange = vi.fn();
  render(<CompactPlanetDial quantity={3} onChange={onChange} />);
  fireEvent.input(screen.getByLabelText(/planets to explore/i), { target: { value: '17' } });
  expect(onChange).toHaveBeenLastCalledWith(17);
});

it('applies a Custom quantity on Enter', async () => {
  render(<ExpeditionConfigurator {...props} />);
  await userEvent.click(screen.getByRole('button', { name: /custom/i }));
  await userEvent.type(screen.getByLabelText(/custom planet count/i), '42{enter}');
  expect(props.onQuantityChange).toHaveBeenCalledWith(42);
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `pnpm test src/components/explore/CompactPlanetDial.test.tsx src/components/explore/ExpeditionConfigurator.test.tsx`

Expected: Custom control is absent and the slider interaction regression is exposed.

- [ ] **Step 3: Implement the controls**

Use `onInput` for range changes. Add a `CUSTOM` button beside the quantity output. When active, render a labelled numeric input with `min=1`, `max=50`; apply `clampExpeditionQuantity` on Enter and blur, then close the input. Keep the slider as the visual source of progress.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `pnpm test src/components/explore/CompactPlanetDial.test.tsx src/components/explore/ExpeditionConfigurator.test.tsx`

Expected: PASS.

### Task 4: Verify the user flow

**Files:**
- Verify only

- [ ] **Step 1: Run static and test verification**

Run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`

Expected: all commands exit 0; report unrelated pre-existing warnings separately if any.

- [ ] **Step 2: Run a browser smoke check**

Open `/play`; drag the slider, enter a Custom value, and confirm Explore does not show a confirmation dialog. Do not submit a wallet transaction.
