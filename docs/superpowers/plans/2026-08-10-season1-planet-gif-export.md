# Season 1 Planet GIF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate ten local animated GIF previews, one for each Season 1 planet type, and package them into one ZIP archive.

**Architecture:** Use the existing Lab-only `derivePlanetPreviewForType` API with one random valid generator input per type. Encode each returned visual through the shared `renderPlanetGif` function, write the ten files to a local artifacts directory, and create a ZIP containing only those files.

**Tech Stack:** TypeScript, `tsx`, `@megaplanets/planet-generator`, Node.js `fs/promises`, and PowerShell `Compress-Archive` only for final packaging if needed.

## Global Constraints

- Keep the export local and visual-only; do not change canonical metadata or production behavior.
- Generate exactly one GIF for each configured Season 1 type.
- Keep GIF output at the generator's native 128x128 logical resolution.
- Do not run deployment, wallet, RPC, or on-chain actions.
- Preserve unrelated existing working-tree changes.

---

### Task 1: Generate and validate the Season 1 GIF bundle

**Files:**
- Create: `artifacts/megaplanets-season1-10-types/*.gif`
- Create: `artifacts/megaplanets-season1-10-types.zip`
- Temporary: system temp directory only; no application source changes.

**Interfaces:**
- Consumes: `createSeason1Config`, `SEASON_1_TYPES`, `derivePlanetPreviewForType`, `renderPlanetGif` from `@megaplanets/planet-generator`.
- Produces: ten named GIF files and one ZIP archive containing exactly those files.

- [ ] **Step 1: Create valid random Lab inputs.**

  For each type, generate a random ticket ID, drawing ID, 5 unique normal balls in the range 1-40, a bonus ball in the range 1-24, and a random 32-byte origin transaction hash. Use a fixed Lab season ID of `0x1111111111111111111111111111111111111111111111111111111111111111`.

- [ ] **Step 2: Derive and render one preview per configured type.**

  Iterate over `SEASON_1_TYPES`, call `derivePlanetPreviewForType(input, createSeason1Config(seasonId), type.id)`, then call `renderPlanetGif(preview.visual)` and write `${index + 1}-${type.id}.gif`.

- [ ] **Step 3: Validate each generated GIF.**

  Read every file as bytes and assert it is non-empty and starts with ASCII `GIF8`.

- [ ] **Step 4: Package exactly the ten GIFs.**

  Create `artifacts/megaplanets-season1-10-types.zip` from the ten output files, with no source files or temporary manifest included.

- [ ] **Step 5: Validate the ZIP contents.**

  List the archive entries and assert there are exactly ten `.gif` entries matching the generated filenames.

- [ ] **Step 6: Run focused generator tests.**

  Run `pnpm --filter @megaplanets/planet-generator golden` and report the result separately from artifact validation.
