# Page ownership

`src/App.tsx` owns the small History API router. The current demo path is:

| Route/view | Owner | Responsibility |
| --- | --- | --- |
| Home | `Home.tsx` | Explain the Megapot → Planet loop and live jackpot context. |
| Play | `Play.tsx` | Dynamic ticket checkout, receipt recovery, reveal, and mint orchestration. |
| Tickets | `Tickets.tsx` | Megapot ticket/history surfaces; Data API data is never mint authority. |
| My Planets | `Planets.tsx` | Direct ERC721A holdings, reveal/claim actions, mining, and provenance. |
| Planet detail | `Planets.tsx` | Deep-linked token detail with current owner/readiness state. |
| Leaderboard | `Leaderboard.tsx` | Daily UTC snapshot and historical day reads. |
| Lab | `Lab.tsx` | Development-only generator inspection; never NFT metadata authority. |

When changing the game loop, read [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
and [`../../docs/OPERATIONS.md`](../../docs/OPERATIONS.md) first. Keep RPC writes and
receipt validation explicit in the owning hook/page; keep display interpolation local.
