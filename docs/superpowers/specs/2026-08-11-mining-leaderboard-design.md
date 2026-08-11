# Off-chain Mining and Weekly Leaderboard Design

## Scope

MegaPlanets minerals are permanent off-chain score. They are never a token,
spendable balance, or claimable asset. This stage connects the existing lazy
mining ledger to the frontend and adds the weekly leaderboard without changing
the working Megapot purchase, drawing, prize-claim, Planet mint, or NFT transfer
flows.

Megapot prize claims remain in scope as lottery functionality. Every reference
to claiming, spending, or tokenizing minerals is removed from product and
architecture documentation.

## Mining authority and arithmetic

The backend remains authoritative. Mineral quantities stay as fixed-point
integers with `MINERAL_SCALE = 1_000_000`; bonuses stay in basis points. The
frontend never calculates an authoritative score.

Each revealed Planet has a time-bounded production segment. A mint, transfer,
or same-Type bonus change settles the previous segment before opening the next
one. Production before a transfer belongs to the previous owner. The existing
same-Type schedule remains 0%, 5%, 10%, and 15% for one, two, three, and four or
more matching Planets.

The wallet mining response contains a server timestamp, aggregate earned score,
effective production per day, and the current mining state of every revealed
Planet. The browser may interpolate the displayed score between backend
refreshes, but every refresh replaces that estimate with the canonical server
snapshot.

Unrevealed tickets never expose mining rates, generated names, art, rarity, or
traits.

## API

Mining adds a public read endpoint because Planet ownership and leaderboard
scores are public:

- `GET /api/wallets/:address/mining`

The existing authenticated `GET /api/me/mining` remains compatible and returns
the same canonical snapshot shape. All bigint values are decimal strings.

Weekly leaderboard endpoints are public:

- `GET /api/leaderboard/current`
- `GET /api/leaderboard/current/:address`
- `GET /api/leaderboard/history`
- `GET /api/leaderboard/weeks/:periodId`

List endpoints use bounded pagination. Current standings include period bounds,
the server timestamp, rank, normalized wallet address, weekly score, and current
effective production per day. The address endpoint also returns the distance to
the next rank when one exists.

## Weekly periods and finalization

A period begins Monday at 00:00 UTC and ends the following Monday at 00:00 UTC.
Live score combines ledger segments within the period with active production
through `min(serverNow, periodEnd)`. Equal scores sort by normalized wallet
address.

Completed periods are finalized in chronological order. Finalization is
idempotent: it settles active segments at the exact period boundary and stores
immutable wallet standings and ranks. API reads ensure overdue periods are
finalized as a safety net, while the same finalizer remains callable by a
long-running worker in deployment.

No per-second or daily accrual cron is introduced.

## Database records

`LeaderboardPeriod` stores the stable period ID, UTC bounds, and finalization
time. `LeaderboardEntry` stores one normalized wallet, its fixed-point score,
effective rate at finalization, and final rank. Unique constraints on period ID
and `(periodId, walletAddress)` make repeated finalization safe.

The immutable mining ledger and active accrual state remain the source from
which live and archived standings can be reproduced.

## Frontend behavior

### My Planets

The collection header shows canonical total earned minerals and effective
minerals per day. Revealed cards use their effective production rate, including
same-Type bonus. The selected revealed Planet shows earned minerals, base rate,
bonus percentage, and effective rate. A lightweight one-second display tick
uses the server snapshot and current effective rate; TanStack Query refreshes
the authoritative snapshot at a slower interval.

Mining failure does not hide owned Planets. The page shows a focused unavailable
state for mining numbers while preserving collection and ticket actions.

### Leaderboard

The page shows the current weekly standings, UTC period bounds, an orbital-style
week progress track, and countdown. Rows contain rank, wallet, weekly minerals,
and effective production per day. The connected wallet row is highlighted; if
it is outside the visible page, a separate sticky summary shows its rank, score,
and distance to the next wallet.

Completed periods are accessible through a compact history control. Loading,
empty, backend-error, disconnected-wallet, desktop, tablet, and mobile states
are explicit. The public table works without a connected wallet.

## Performance and accessibility

The frontend performs one aggregated mining request per wallet rather than one
request per Planet. Leaderboard polling is deduplicated through TanStack Query.
Frequently changing display values are isolated from Planet artwork and table
structure to avoid broad rerenders.

All controls remain keyboard accessible, data labels do not rely on color, and
motion respects `prefers-reduced-motion`.

## Verification

Backend unit tests cover UTC boundaries, overlap arithmetic, bonuses, tie
sorting, distance-to-next-rank, pagination, idempotent finalization, transfer
settlement, and decimal-string serialization. Frontend tests cover mining
mapping, interpolation, leaderboard states, connected-wallet highlighting, and
responsive detail behavior.

Required repository checks are `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
`pnpm build`. Desktop and mobile flows are then checked in the running site,
which remains launched after completion.
