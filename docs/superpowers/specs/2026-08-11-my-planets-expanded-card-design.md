# My Planets Expanded Card Design

## Goal

Restyle the selected planet detail in My Planets to match the supplied portrait
reference while preserving the existing MegaPlanets palette, responsive
list-detail behavior, ticket provenance, mining backend, claim transaction flow,
and unrevealed-planet privacy boundary.

## Scope

- Update the selected revealed and unrevealed presentations in
  `PlanetInventoryDetail`.
- Reuse the existing `Planets` composition boundary, ticket lifecycle hooks,
  wallet mining snapshot, GIF renderer, and claim hook.
- Add the supplied mine and same-type bitmap icons as presentation assets. Keep
  the existing mineral icon.
- Add focused component and page tests for the new content, states, links, and
  interactions.
- Do not change ticket purchases, approvals, vouchers, minting, indexer
  behavior, mining calculations, or contract writes.

## Revealed Planet Layout

The revealed detail remains the desktop selected-planet side panel and the
mobile or direct-route full-page detail. It uses the current palette tokens and
type system instead of copying colors from the reference.

### Planet artwork and stat overlay

The animated planet GIF remains the primary visual. A single stat panel is
positioned as an overlay across the lower portion of the artwork. It contains:

1. The existing mineral icon with `baseMineralsPerDay` and the label
   `MINERALS / DAY`.
2. The supplied mine icon with the live mined total, calculated by the existing
   `LiveMineralAmount` component from the backend snapshot and its `asOf` time.
3. The supplied same-type icon with the percentage bonus derived from
   `multiplierBps` as `(multiplierBps - 10_000) / 100`.

The overlay must remain readable against every generated planet. It uses the
existing raised/surface colors with controlled opacity, border, and backdrop
treatment. On narrow panels it may wrap into a two-plus-one grid while
remaining inside the artwork bounds. Missing mining data is shown explicitly
as unavailable; generated trait values must not be substituted for backend
mining state.

### Identity and ticket state

The planet name and type follow the artwork. The ticket panel contains the five
normal coordinates, a visually distinct bonus ball, and the real lifecycle
badge from `PlanetTicketStatus`.

The primary lifecycle control renders one of:

- `HH:MM:SS`
- `Drawing`
- `Claim ($X)`
- `Claimed ($X)`
- `Drawn`
- an explicit unavailable state

Only `Claim ($X)` starts a transaction, using the existing
`useClaimWinnings` flow and on-chain ticket ID. Other lifecycle values are
state displays and do not perform a misleading navigation or transaction.
Receipt confirmation continues to trigger ticket-status refetching.

### Details section

`Details` is always visible and expanded. There is no collapse control,
chevron, `aria-expanded` state, or hidden content. The section contains:

- Terrain
- Type
- Satellites
- Clouds
- Rarity
- Base minerals

The section ends with two explorer links:

- `Ticket / BaseScan` links to the canonical purchase transaction from the
  ticket `originTxHash`.
- `NFT / BaseScan` links to the configured MegaPlanets contract and selected
  `tokenId`.

Links open in a new tab with safe `rel` attributes. When their canonical input
is missing, the UI shows an unavailable label instead of constructing a broken
URL.

## Unrevealed Ticket Layout

The unrevealed selected item uses the same ticket panel language as a revealed
planet but contains only information that is safe before mint/reveal:

- Ticket ID
- five normal coordinates and bonus ball
- real ticket lifecycle badge/control
- `Ticket / BaseScan` purchase-transaction link
- the existing Mint action when eligible

It must not render or derive the planet GIF, generated name, type, minerals,
rarity, terrain, clouds, satellites, rings, mining rate, same-type bonus, or any
other deterministic planet trait. It does not render an NFT link because no
NFT exists yet.

## Data Flow

`Planets` continues to merge canonical eligible ticket provenance with indexed
NFT ownership. It passes the selected item's existing values into
`PlanetInventoryDetail`:

- `preview` supplies safe ticket coordinates and, only after reveal, generated
  identity and visual traits.
- `PlanetTicketStatus` supplies countdown, drawing, claim, claimed, drawn, or
  unavailable state.
- `PlanetMiningSnapshot` supplies base rate, multiplier, effective rate, and
  mined totals.
- `originTxHash` supplies the ticket transaction link.
- indexed `tokenId` plus the configured MegaPlanets contract supplies the NFT
  explorer link.

No new backend endpoint or protocol assumption is introduced.

## Assets and Visual Treatment

The supplied mine and same-type PNGs are stored under `src/assets`. If they are
monochrome with transparency, they are rendered through CSS masks so the
current accent token controls their color. The mineral icon remains unchanged.
All controls preserve visible keyboard focus, and decorative icons do not
duplicate accessible labels.

## Error and Loading States

- Mining loading or failure does not invent zero values; the overlay identifies
  unavailable backend state.
- Ticket status failure remains explicit and disables the lifecycle action.
- Missing transaction provenance disables only the Ticket BaseScan link.
- Missing contract configuration or `tokenId` disables only the NFT BaseScan
  link.
- GIF loading and failure retain the existing static pixelated fallback.

## Responsive Behavior

- Desktop retains the current collection and sticky selected-detail split.
- Direct `/planet/:id` and mobile detail reuse the same component at a wider
  size.
- The artwork overlay responds to the available width without horizontal
  scrolling or covering the planet identity below it.
- Ticket coordinates and details use compact grids that remain legible at the
  narrowest supported viewport.

## Testing and Verification

Test-first coverage will verify:

- revealed stat overlay values and supplied icon roles;
- live mined total and same-type percentage mapping from backend fields;
- contextual lifecycle labels and claim-only interaction;
- always-visible Details fields and absence of collapse behavior;
- canonical Ticket and NFT BaseScan URLs and missing-link states;
- unrevealed ticket coordinates, status, link, and Mint action;
- absence of every generated identity, visual, mining, and trait value in the
  unrevealed branch;
- responsive component structure without changing route behavior.

Stage verification is `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
`pnpm build`, followed by local desktop and mobile browser inspection of My
Planets. Local verification is not a claim about live RPC, wallet, BaseScan, or
production behavior.
