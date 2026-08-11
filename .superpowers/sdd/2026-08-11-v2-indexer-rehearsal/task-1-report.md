# Task 1 Implementation Report

## Scope

Task 1: deployment closure and durable documentation for the deployed Base
Sepolia MegaPlanets ERC721A V2, without enabling runtime defaults.

## Changed files

- `contracts/script/deploy-v2-approved.sh`
- `contracts/script/verify-v2-basescan.sh`
- `contracts/README.md`
- `docs/V2_INDEXER_REHEARSAL_RUNBOOK.md`
- `docs/superpowers/plans/2026-08-11-v2-indexer-rehearsal.md`
- `docs/STATUS.md`
- `api/README.md`

## What changed

1. Reconciled the stale contracts documentation with the already-recorded V2
   deployment identity:
   - V2 address `0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`
   - deployment transaction
     `0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`
   - deployment block `45,347,860`
   - Sourcify status `exact_match`
   - BaseScan status still pending
2. Removed the unused `BASESCAN_API_KEY` prompt from the approved deploy script.
3. Changed the BaseScan verify script to fail closed unless
   `BASESCAN_API_KEY` is already present in the session environment.
4. Added a durable runbook at `docs/V2_INDEXER_REHEARSAL_RUNBOOK.md` with:
   - the exact deployment and verification commands;
   - the current Sourcify/BaseScan state;
   - the runtime activation gate;
   - the exact env-only activation values, while keeping checked-in defaults
     disabled.
5. Threaded the same command/gate record through:
   - `docs/superpowers/plans/2026-08-11-v2-indexer-rehearsal.md`
   - `docs/STATUS.md`
   - `api/README.md`

## Commands run

### Discovery and inspection

```sh
git status --short --branch
rg -n "Sourcify|BaseScan|Base Sepolia|runtime|activation gate|indexer|deployment|verify" docs api . -g '!node_modules'
rg --files docs api .superpowers | rg 'STATUS\.md$|README\.md$|runbook|deploy|verify|sourcify|basescan|indexer'
sed -n '1,220p' docs/superpowers/plans/2026-08-11-v2-indexer-rehearsal.md
sed -n '1,240p' docs/STATUS.md
sed -n '1,220p' api/README.md
sed -n '1,220p' contracts/README.md
sed -n '1,220p' contracts/script/deploy-v2-approved.sh
sed -n '1,220p' contracts/script/verify-v2-basescan.sh
printenv | rg '^BASESCAN(_API_KEY)?='
sed -n '68,140p' .env.example
sed -n '1,140p' api/config.ts
sed -n '140,210p' src/config/contracts.ts
git show --stat --summary 9eab20d
git show --name-only --format=medium 9eab20d | sed -n '1,220p'
```

### Verification

```sh
bash -n contracts/script/deploy-v2-approved.sh contracts/script/verify-v2-basescan.sh
git diff --check
env -u BASESCAN_API_KEY bash contracts/script/verify-v2-basescan.sh
git status --short
git diff --stat
```

## Command output highlights

- `printenv | rg '^BASESCAN(_API_KEY)?='` returned no matches, so no live
  BaseScan verification attempt was made.
- `bash -n contracts/script/deploy-v2-approved.sh contracts/script/verify-v2-basescan.sh`
  exited `0`.
- `git diff --check` exited `0`.
- `env -u BASESCAN_API_KEY bash contracts/script/verify-v2-basescan.sh`
  exited `1` with:

  ```text
  Set BASESCAN_API_KEY in the session environment before running this script.
  ```

  This is the intended Task 1 gate.

## Verification summary

- Shell syntax checks passed for both deployment scripts.
- The BaseScan verify script now refuses to run without a session-provided API
  key.
- No frontend, API, Prisma, or Foundry test suites were run because Task 1 only
  changed documentation and shell-script gating, not runtime application logic.

## Concerns

1. BaseScan verification is still pending because this session did not provide
   `BASESCAN_API_KEY`.
2. `docs/superpowers/plans/2026-08-11-v2-indexer-rehearsal.md` was already
   untracked when this task began; it was updated in place because Task 1
   explicitly required the plan document to carry the command/gate record.
