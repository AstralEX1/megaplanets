# My Planets Inventory Design

## Goal

Replace the current generic planet gallery with an adaptive list-detail inventory. It must make minted NFTs comparable at a glance while keeping unrevealed ticket information private.

## Data and state boundaries

- Merged local/on-chain ticket provenance remains the source for a ticket's drawing ID.
- The Megapot Data API is used only for historical drawing state. Its two trustworthy states are `active` and `settled`; the UI labels them `DRAWING ACTIVE` and `DRAWING SETTLED`.
- Indexed ownership and locally confirmed mint receipts determine whether a ticket is revealed.
- Revealed cards display preview, name, type, minerals/day, and drawing state.
- Unrevealed cards display only drawing state and a single `Mint` control. They must not expose generated name, type, preview, or minerals.
- Existing voucher preparation, simulation, wallet write, receipt confirmation, and Base Sepolia checks remain unchanged.

## Layout

Desktop uses a two-pane list-detail layout: a card grid on the left and selected-card detail on the right. The selected card uses a persistent high-contrast outline; hover and keyboard focus are temporary states. Mobile converts this into a card grid followed by the selected detail panel.

Cards follow Material 3 guidance: one card-level selection interaction, an explicit action only for unrevealed minting, clear state labels, and responsive layouts. The visual signature remains the pixel-planet preview against the MegaPlanets dark instrument surface.

## Detail panels

Revealed detail shows its large pixel render, title, type, minerals/day, drawing state, ticket numbers, deterministic seed, and traits hash. Unrevealed detail contains only the drawing status and existing `MintPlanetButton` output.

## Error handling

If a historical round cannot be read, the card shows `DRAWING STATUS UNAVAILABLE`; it does not infer a state. Index and RPC error notices remain visible.

## Verification

Tests cover visible card data boundaries, selected detail behavior, and status mapping. Run lint, typecheck, the full test suite, production build, and a browser inspection of `/planets`.
