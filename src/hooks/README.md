# Hook boundaries

Hooks keep RPC, TanStack Query, and browser state behind small typed boundaries.

- Live Megapot drawing state, ticket purchases, allowance checks, and mint/claim writes
  use wagmi/RPC.
- Ticket eligibility merges durable server Megastera Proofs with canonical receipt
  recovery; the Data API only locates historical candidate transactions.
- `useIndexedPlanets` reads direct ERC721A holdings by default. Indexed backend rows are an
  explicit compatibility fallback.
- `useWalletMining` reads lifetime production and may interpolate the display locally; it
  never writes mineral state.
- Leaderboard hooks read finalized daily UTC snapshots. The browser never finalizes them.
- `useBulkPurchase` and ticket recovery are disabled while the Play form is idle to avoid
  unnecessary facilitator/RPC polling.

Protocol contract-call changes require reading `.agents/skills/megapot/SKILL.md`; repository
source-of-truth and verification rules are in [`../../AGENTS.md`](../../AGENTS.md) and
[`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
