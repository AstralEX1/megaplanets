# Random Mystery Planets Design

## Goal

Use the eight supplied mystery-planet PNG variants for every unrevealed planet presentation while keeping unrevealed identity and traits private. Increase the Play orbit stage vertically so the rotating planets have more room above and below the controls.

## Scope

- Play orbit visualization.
- Post-purchase reveal screen.
- My Planets unrevealed cards and selected detail.
- Shared tests for mystery artwork selection and orbit dimensions.

This change does not modify ticket ownership, purchase, reveal, drawing, mining, or blockchain behavior.

## Assets

Copy all eight supplied PNG files into a dedicated frontend asset directory:

- blue
- cyan
- green
- lime
- magenta
- orange
- red
- violet

The images remain source assets without recoloring or generated derivatives. Rendering keeps `image-rendering: pixelated` and crops the 3:2 source around its centered planet where a square presentation is required.

## Random Selection

Expose the asset list and one small helper that returns an entry selected with `Math.random()`.

Each mounted `UnrevealedPlanetVisual` chooses one random variant during its initial render. The selection is not stored, seeded, or tied to a Ticket ID. A remount may therefore show a different color, which is intentional.

The Play orbit creates one random asset entry for each visible orbit item. Rebuilding the orbit list, such as after changing the quantity, may choose new colors. This keeps the implementation deliberately simple.

## Shared Presentation

`UnrevealedPlanetVisual` remains the common presentation component for reveal and My Planets. Replacing its single legacy image with a random pack image automatically updates:

- the post-purchase mystery stack;
- unrevealed My Planets cards;
- the selected unrevealed My Planets detail.

The component continues to accept accessible labels and does not expose generated names, rarity, minerals, terrain, or other deterministic traits.

## Play Orbit

`StaticDepthStack` uses the same asset list for every orbit item instead of repeating one legacy image.

Increase the orbit stage height from 350 pixels to 500 pixels. For multi-planet orbits, calculate the vertical ellipse radius as `min(190, max(90, 72 + visibleCount * 5))` pixels instead of the current `min(130, max(60, 44 + visibleCount * 4))`. The stage expands both above and below the orbit center while the headline, quantity control, Explore action, and coordinate drawer retain their existing hierarchy. The desktop layout must not gain horizontal overflow, and the mobile viewport must keep the controls reachable without clipping.

## Testing

- Mock `Math.random()` and verify that the shared unrevealed component selects the expected pack variant.
- Verify that the orbit renders mixed pack images and no longer uses the legacy asset.
- Verify the enlarged stage height and expanded vertical orbit path.
- Run the existing Play, reveal, and My Planets component tests.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Inspect Play and My Planets at desktop and mobile widths, then leave the site running on `/play`.

## Out of Scope

- Stable colors across reloads or navigation.
- Ticket-based color mapping.
- Asset recoloring or procedural mystery-planet generation.
- Changes to revealed planet cards or blockchain flows.
