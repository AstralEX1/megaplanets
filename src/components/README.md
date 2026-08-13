# Component boundaries

Components are grouped by surface. Pages own orchestration; components receive already
validated view data and render loading, empty, unavailable, and error states without
inventing protocol values.

- `common/` — buttons, approval UX, transaction status, and layout primitives.
- `layout/` — navigation, wallet shell, footer, and disclaimer.
- `explore/` — the Play expedition configurator, recovery/progress, and reveal screens.
- `lottery/` — Megapot drawing state and direct/bulk checkout presentation.
- `planets/` — ticket/Planet cards, deterministic preview/media, reveal, claim, and
  lifetime mining overlay.
- `leaderboard/` — daily snapshot progress, rank card, and responsive standings table.

Do not add retired same-type, accrual, transfer-settlement, or weekly concepts to the active UI.
Source-of-truth rules live in [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
