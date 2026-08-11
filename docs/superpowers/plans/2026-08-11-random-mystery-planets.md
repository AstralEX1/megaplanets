# Random Mystery Planets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every unrevealed planet visual with a fully random image from the supplied eight-color pack and enlarge the Play orbit vertically.

**Architecture:** A focused asset module owns the eight imported URLs and the `randomMysteryPlanet()` selector. `UnrevealedPlanetVisual` selects once per mount, while `StaticDepthStack` generates one random URL per visible orbit slot and passes the list to the existing `OrbitImages` component.

**Tech Stack:** React 19, TypeScript, Vite asset imports, Vitest, Testing Library, Tailwind CSS, Motion.

## Global Constraints

- Use all eight supplied PNG files without recoloring or generated derivatives.
- Selection uses `Math.random()` only; do not store, seed, or tie colors to Ticket IDs.
- Keep unrevealed names, rarity, minerals, terrain, and deterministic traits private.
- Do not modify purchase, reveal, drawing, mining, backend, or blockchain behavior.
- Keep square mystery art cropped around the centered planet and pixelated.
- Set the Play orbit stage height to exactly 500 pixels.
- Preserve the existing quantity, Explore, and coordinate controls.
- Use pnpm for every JavaScript command.

---

### Task 1: Shared random mystery artwork

**Files:**
- Create: `src/assets/mystery-planets/blue.png`
- Create: `src/assets/mystery-planets/cyan.png`
- Create: `src/assets/mystery-planets/green.png`
- Create: `src/assets/mystery-planets/lime.png`
- Create: `src/assets/mystery-planets/magenta.png`
- Create: `src/assets/mystery-planets/orange.png`
- Create: `src/assets/mystery-planets/red.png`
- Create: `src/assets/mystery-planets/violet.png`
- Create: `src/assets/mystery-planets.ts`
- Modify: `src/components/planets/UnrevealedPlanetVisual.tsx`
- Test: `src/components/planets/UnrevealedPlanetVisual.test.tsx`

**Interfaces:**
- Produces: `MYSTERY_PLANET_IMAGES: readonly string[]`.
- Produces: `randomMysteryPlanet(random?: () => number): string`.
- Preserves: `UnrevealedPlanetVisual({ label, className? })`.

- [ ] **Step 1: Copy the supplied binary assets**

Extract `C:\Users\alexe\Downloads\mystery_planets_png.zip` and copy the eight named PNG files into `src/assets/mystery-planets/`. Do not alter their contents.

- [ ] **Step 2: Write failing selector and presentation tests**

Update `UnrevealedPlanetVisual.test.tsx` to mock random selection and assert the exact pack entry:

```tsx
import { vi } from 'vitest';

it('selects a random mystery color once for each mount', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.99);
  render(<UnrevealedPlanetVisual label="Unrevealed planet" />);

  expect(screen.getByRole('img', { name: 'Unrevealed planet' })).toHaveAttribute(
    'src',
    expect.stringContaining('violet'),
  );
  expect(Math.random).toHaveBeenCalledTimes(1);
});
```

Retain the existing assertion that no traits are disclosed.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `pnpm test -- src/components/planets/UnrevealedPlanetVisual.test.tsx`

Expected: FAIL because the component still imports `unrevealed-planet.png` and never calls `Math.random()`.

- [ ] **Step 4: Add the asset selector**

Create `src/assets/mystery-planets.ts` with direct Vite imports and a clamped index:

```ts
import blue from './mystery-planets/blue.png';
import cyan from './mystery-planets/cyan.png';
import green from './mystery-planets/green.png';
import lime from './mystery-planets/lime.png';
import magenta from './mystery-planets/magenta.png';
import orange from './mystery-planets/orange.png';
import red from './mystery-planets/red.png';
import violet from './mystery-planets/violet.png';

export const MYSTERY_PLANET_IMAGES = [blue, cyan, green, lime, magenta, orange, red, violet] as const;

export function randomMysteryPlanet(random: () => number = Math.random) {
  const index = Math.min(MYSTERY_PLANET_IMAGES.length - 1, Math.floor(random() * MYSTERY_PLANET_IMAGES.length));
  return MYSTERY_PLANET_IMAGES[index];
}
```

- [ ] **Step 5: Select one asset per component mount**

Replace the legacy import in `UnrevealedPlanetVisual.tsx` and use lazy state initialization:

```tsx
import { useState } from 'react';
import { randomMysteryPlanet } from '@/assets/mystery-planets';

const [image] = useState(randomMysteryPlanet);
return <img className={`block object-cover ${className}`} src={image} ... />;
```

This selection remains stable only for that mount and may change after a remount.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run: `pnpm test -- src/components/planets/UnrevealedPlanetVisual.test.tsx`

Expected: PASS with the violet source and one random call.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- src/assets/mystery-planets src/assets/mystery-planets.ts src/components/planets/UnrevealedPlanetVisual.tsx src/components/planets/UnrevealedPlanetVisual.test.tsx
git commit -m "feat: add random mystery planet artwork"
```

---

### Task 2: Randomized, taller Play orbit

**Files:**
- Modify: `src/components/explore/StaticDepthStack.tsx`
- Modify: `src/components/explore/StaticDepthStack.test.tsx`
- Modify: `src/components/explore/OrbitImages.css`

**Interfaces:**
- Consumes: `MYSTERY_PLANET_IMAGES` and `randomMysteryPlanet()` from Task 1.
- Preserves: `StaticDepthStack({ quantity, maxVisiblePlanets? })`.
- Produces: a 500-pixel stage and multi-planet vertical radius `min(190, max(90, 72 + visibleCount * 5))`.

- [ ] **Step 1: Write failing orbit tests**

In `StaticDepthStack.test.tsx`, mock a sequence of random values and update assertions:

```tsx
vi.spyOn(Math, 'random')
  .mockReturnValueOnce(0)
  .mockReturnValueOnce(0.99)
  .mockReturnValue(0.5);

render(<StaticDepthStack quantity={3} />);

expect(screen.getByRole('group', { name: 'Selected planets visualization' })).toHaveStyle({
  height: '500px',
});
expect(screen.getAllByRole('img', { name: /selected planet/i })[0]).toHaveAttribute(
  'src',
  expect.stringContaining('blue'),
);
expect(screen.getAllByRole('img', { name: /selected planet/i })[1]).toHaveAttribute(
  'src',
  expect.stringContaining('violet'),
);
expect(screen.getByTestId('planet-orbit').querySelector('.orbit-item')).toHaveStyle({
  offsetPath: expect.stringContaining('A 425 90'),
});
```

Also assert that `OrbitImages.css` behavior is represented by the `.orbit-image` class remaining on every image; browser QA will verify the crop.

- [ ] **Step 2: Run the focused orbit test and verify RED**

Run: `pnpm test -- src/components/explore/StaticDepthStack.test.tsx`

Expected: FAIL because the stage remains 350 pixels, uses one legacy URL, and has the old 60-pixel minimum vertical radius.

- [ ] **Step 3: Generate random orbit URLs and expand the stage**

Update `StaticDepthStack.tsx`:

```tsx
import { useMemo } from 'react';
import { randomMysteryPlanet } from '@/assets/mystery-planets';

const images = useMemo(
  () => Array.from({ length: visibleCards }, () => randomMysteryPlanet()),
  [visibleCards],
);
const radiusY = visibleCards === 1 ? 1 : Math.min(190, Math.max(90, 72 + visibleCards * 5));
const visualHeight = 500;
```

Keep the current maximum of 50 visible planets, item-size calculation, animation duration, and horizontal radius.

- [ ] **Step 4: Crop orbit images around the centered mystery planet**

Update `.orbit-image` in `OrbitImages.css` from `object-fit: contain` to `object-fit: cover`. Keep `image-rendering: pixelated` and pointer-event behavior unchanged.

- [ ] **Step 5: Run focused Play and inventory presentation tests**

Run:

```powershell
pnpm test -- src/components/explore/StaticDepthStack.test.tsx src/components/explore/ExpeditionSuccessScreens.test.tsx src/components/planets/UnrevealedPlanetVisual.test.tsx src/components/planets/PlanetInventoryCard.test.tsx src/components/planets/PlanetInventoryDetail.test.tsx src/pages/Play.test.tsx src/pages/Planets.test.tsx
```

Expected: all focused tests PASS; tests continue proving unrevealed trait privacy.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- src/components/explore/StaticDepthStack.tsx src/components/explore/StaticDepthStack.test.tsx src/components/explore/OrbitImages.css
git commit -m "feat: expand the mystery planet orbit"
```

---

### Task 3: Full verification and browser QA

**Files:**
- No production files unless verification reveals a scoped defect.

**Interfaces:**
- Consumes: the shared mystery asset selector and expanded orbit from Tasks 1-2.
- Produces: verification evidence for desktop and mobile Play, Reveal, and My Planets presentations.

- [ ] **Step 1: Run all required repository checks**

Run sequentially:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 2: Launch or reuse the local site**

Run `pnpm dev -- --host 127.0.0.1 --port 5180` and keep the process alive after verification.

- [ ] **Step 3: Inspect desktop layouts**

At 1440x900:

- `/play` shows randomly colored mystery planets with more vertical orbit room;
- quantity and Explore controls remain reachable;
- the coordinate panel still opens on the right;
- `/my-planets` unrevealed cards and selected detail use pack images;
- no horizontal overflow or console errors appear.

- [ ] **Step 4: Inspect mobile layouts**

At 390x844:

- the taller orbit does not clip the planet glow;
- quantity, Explore, and inline coordinate controls remain reachable;
- unrevealed My Planets cards remain square and crisp;
- no horizontal overflow or console errors appear.

- [ ] **Step 5: Report exact evidence**

Report changed files, copied assets, focused and full test results, desktop/mobile observations, any untested wallet-only behavior, and the running URL `http://127.0.0.1:5180/play`.
