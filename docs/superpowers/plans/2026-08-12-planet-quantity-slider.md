# Planet Quantity Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom planet quantity track with Material UI's controlled Slider while retaining exact manual quantity entry.

**Architecture:** `Play` remains the single owner of the quantity state. `CompactPlanetDial` keeps its existing `quantity`/`onChange` interface, renders MUI's `Slider` for range interaction, and keeps its local custom-input visibility and text state for exact entry. All emitted values continue through `clampExpeditionQuantity` before reaching the parent.

**Tech Stack:** React 19, TypeScript, Material UI Slider, Emotion, Vitest, Testing Library, pnpm, Biome.

## Global Constraints

- Source code, identifiers, filenames, tests, and technical documentation remain in English.
- Use pnpm; do not introduce another JavaScript package manager.
- Keep quantity range 1 through 50 and integer step 1.
- Preserve Enter/blur manual entry and normalize submitted values with `clampExpeditionQuantity`.
- Use MUI `sx` styling to match the existing dark MegaPlanets palette; do not add an app-wide MUI theme.
- Do not change purchase routing, quantity state ownership, ticket coordinates, or expedition flow.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before handoff.

---

### Task 1: Add the MUI Slider dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces the `@mui/material`, `@emotion/react`, and `@emotion/styled` packages required by the component.

- [x] **Step 1: Install the packages with pnpm**

Run:

```bash
pnpm add @mui/material @emotion/react @emotion/styled
```

Expected: `package.json` and `pnpm-lock.yaml` contain the new runtime dependencies.

### Task 2: Specify the new slider behavior in tests

**Files:**
- Modify: `src/components/explore/CompactPlanetDial.test.tsx`

**Interfaces:**
- Consumes: the existing `CompactPlanetDial` props and callback contract.
- Produces: focused behavior checks for the MUI range input, quantity landmarks, keyboard/change updates, and manual entry.

- [x] **Step 1: Assert the slider is an accessible native range input with all landmarks**

Add assertions that the `Planets to explore` slider has `type="range"`, `aria-valuemin="1"`, `aria-valuemax="50"`, `aria-valuenow="3"`, and visible labels `1`, `5`, `10`, `25`, and `50`.

- [x] **Step 2: Assert range changes and manual entry reach the existing callback**

Use `fireEvent.change(slider, { target: { value: '25' } })` to assert `onChange` receives `25`, and use the existing Custom control to enter `42` and assert the callback receives `42`.

- [x] **Step 3: Run the focused test and verify the expected red state**

Run:

```bash
pnpm exec vitest run src/components/explore/CompactPlanetDial.test.tsx
```

Expected: the current custom `div[role="slider"]` fails the `type="range"`/landmark expectations, proving the test detects the missing MUI implementation.

### Task 3: Replace the custom track with the controlled MUI Slider

**Files:**
- Modify: `src/components/explore/CompactPlanetDial.tsx`

**Interfaces:**
- Consumes: `quantity`, `onChange`, and `clampExpeditionQuantity` from the existing component contract.
- Produces: a controlled MUI Slider with `min={1}`, `max={50}`, `step={1}`, `marks`, `valueLabelDisplay="auto"`, and the accessible value text `<count> planets`.

- [x] **Step 1: Replace pointer/key event plumbing with MUI Slider**

Import `Slider` from `@mui/material/Slider`, define marks for `1`, `5`, `10`, `25`, and `50`, and forward numeric values from MUI's `onChange` callback through `clampExpeditionQuantity`.

- [x] **Step 2: Preserve the manual input flow**

Keep the Custom button, input label, 1–50 HTML constraints, Enter handler, blur handler, and empty-input behavior. Both manual input and slider changes must update the same parent callback.

- [x] **Step 3: Apply the MegaPlanets visual treatment with `sx`**

Style the rail, track, thumb, marks, labels, hover state, and focus ring using the existing CSS variables. Keep the existing layout and the `Planets to explore` label unchanged.

### Task 4: Verify the implementation

**Files:**
- Inspect: `src/components/explore/CompactPlanetDial.tsx`
- Inspect: `src/components/explore/CompactPlanetDial.test.tsx`

**Interfaces:**
- Consumes: the completed slider and focused tests.
- Produces: verified source, test, lint, typecheck, and production-build results.

- [x] **Step 1: Run the focused component test**

Run `pnpm exec vitest run src/components/explore/CompactPlanetDial.test.tsx` and require zero failures.

- [x] **Step 2: Run repository lint and typecheck**

Run `pnpm lint` and `pnpm typecheck`; resolve only issues caused by this change.

- [x] **Step 3: Run the full test suite and production build**

Run `pnpm test` and `pnpm build`. Report any pre-existing unrelated timeout separately from failures caused by the slider.
