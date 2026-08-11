# My Planets Ticket Status Polish Design

## Goal

Polish the existing Play and My Planets flows without changing purchase, mint,
indexer, or backend architecture. The UI must check allowance before offering
approval, keep the Play controls fixed while coordinates open to the right,
and expose a single real ticket lifecycle status across planet cards and the
selected detail panel.

## Approved behavior

- Use an approve-once USDC allowance for the route-specific spender. Continue
  to compare the current allowance with the exact purchase requirement before
  showing approval.
- Keep the central Play controls at a fixed desktop x-position. The coordinates
  drawer occupies a right-side column and must not recenter the planet controls.
- Use a dedicated `usePlanetTicketStatuses` hook that combines live RPC drawing
  state with historical wallet-ticket data.
- Ticket status labels are: clock icon plus `HH:MM:SS`, `Drawing`,
  `Claim ($X)`, `Claimed ($X)`, and `Drawn`.
- A revealed card shows the mineral icon and mineral value on the left and the
  ticket status on the right. Rarity is represented only by the border.
- An unrevealed card remains private. It may show ticket lifecycle status,
  Ticket ID, and the purchased coordinates; it must not show generated artwork,
  name, type, minerals, rarity, or deterministic traits.
- Clicking an unrevealed card selects it and shows its ticket coordinates in the
  detail panel. Mint remains a separate action and must not trigger selection.
- The selected revealed planet uses the existing GIF worker. A static thumbnail
  is the loading/error fallback and remains pixelated.
- `Claim ($X)` calls the existing `useClaimWinnings` transaction hook with the
  real on-chain ticket ID. After a confirmed receipt, wallet ticket state is
  refetched. No winnings amount is mocked or inferred.

## Data boundaries

Live drawing lifecycle and countdown timing come from Jackpot RPC state.
Historical per-ticket winnings and claim state come from the existing Megapot
Data API ticket model (`winnings_amount`, `claimed`, `user_ticket_id`). Claiming
uses the existing Jackpot simulation/write/receipt flow. API failure is surfaced
explicitly instead of converting an unknown result into `Drawn`.

## Responsive behavior

Desktop keeps the collection/detail split. Tablet reduces collection width and
columns. Mobile keeps the collection as the main view; revealed planets open the
existing full-page `/planet/:id` detail route, while unrevealed planets remain
selectable in-page so their coordinates can be inspected without exposing a
nonexistent planet route.

