# Unrevealed Planet GIF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce one looping GIF showing a hidden planet silhouette with a centered pixel question mark.

**Architecture:** Render a deterministic source preview through the existing planet generator, transform each RGBA frame into a dark circular silhouette, overlay a pixel question mark, and encode the transformed frames with `gifenc`.

**Tech Stack:** TypeScript, bundled Node.js, `tsx`, `@megaplanets/planet-generator`, `gifenc`, and Node `fs/promises`.

## Global Constraints

- Keep the export local and visual-only.
- Do not modify generator, Lab, frontend, metadata, contract, or production files.
- Keep output at 128x128 and loop the animation.
- Remove the temporary export script after generation.

---

### Task 1: Generate and validate the unrevealed GIF

**Files:**
- Create: `artifacts/unrevealed-planet-question.gif`
- Temporary: `artifacts/.generate-unrevealed.ts`

**Interfaces:**
- Consumes: `derivePlanetPreviewForType`, `renderPlanetFrame`, `GENERATOR_CONFIG` from `@megaplanets/planet-generator` and `GIFEncoder`/`applyPalette` from `gifenc`.
- Produces: one validated 128x128 looping GIF.

- [ ] **Step 1: Render the source preview frames.**

  Use a fixed valid Lab input and render every configured frame time from 0 through `GENERATOR_CONFIG.durationMs`.

- [ ] **Step 2: Transform each frame.**

  Mask the planet disk to dark blue-black colors, add a dim rim, and draw a centered 5x7 pixel `?` glyph in pale lavender.

- [ ] **Step 3: Encode the GIF.**

  Use a fixed palette, 80ms frame delays, and repeat count 0; write the output to `artifacts/unrevealed-planet-question.gif`.

- [ ] **Step 4: Validate and clean up.**

  Assert the GIF signature, 128x128 logical screen, non-zero size, and 144 frames; then delete the temporary script.
