# Main README Documentation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Replace the short repository landing page with a complete, accurate description of the MegaPlanets game and link the checked-in golden GIF fixtures as visual examples.

**Architecture:** Keep the root `README.md` as the public product and developer entry point. Keep implementation detail in the existing `docs/` and package READMEs, adding only cross-links and a fixture index where it improves discoverability. Reference GIFs by repository-relative paths so they render on GitHub without duplicating binary assets.

**Tech Stack:** Markdown, GitHub relative links, the existing TypeScript/Vitest golden fixtures, and the repository's Base Sepolia deployment records.

## Global Constraints

- Write documentation in English, matching repository source language.
- Describe Base Sepolia only; do not imply mainnet readiness.
- Keep the V1 deployment explicitly unsupported and identify the seasonless ERC721A V2 deployment from the current status record.
- Preserve the intentional unlimited USDC approval policy and its allowance check/security trade-off.
- Use only existing GIF fixtures; do not regenerate or modify binary assets.

### Task 1: Build the public game overview

**Files:**
- Modify: `README.md`

- [ ] Add a concise product summary and a numbered ticket-to-Planet gameplay loop.
- [ ] Document ticket purchase routes, eligibility/provenance, deterministic reveal, voucher minting, mining, same-Type bonuses, and weekly leaderboard behavior.
- [ ] Document the on-chain/off-chain boundaries, Base Sepolia deployment identity, current release gate, local setup, environment categories, and verification commands.
- [ ] Add links to the durable architecture, product, status, roadmap, contract, API, and generator documentation.

### Task 2: Add golden fixture gallery and generator navigation

**Files:**
- Modify: `README.md`
- Modify: `packages/planet-generator/README.md`

- [ ] Add a gallery using `ticket-456.gif`, `ticket-1001.gif`, and `ticket-4242.gif` from `packages/planet-generator/tests/fixtures/`.
- [ ] Label each fixture with its ticket ID, derived Type, rarity, and purpose as a byte-for-byte golden regression asset.
- [ ] Link the fixture manifest and golden test command so readers can reproduce the examples.

### Task 3: Refresh documentation status and verify

**Files:**
- Modify: `docs/STATUS.md`

- [ ] Add a short note pointing readers to the root README as the public game overview and record the golden gallery location.
- [ ] Check Markdown links and fixture paths with repository-local commands.
- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before committing the documentation changes.
- [ ] Commit the documentation-only changes with an English Conventional Commit message.
