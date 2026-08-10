# Season 1 Planet GIF Export

## Goal

Generate a local preview bundle containing ten animated GIFs, one for each Season 1
planet type, and package the files into one ZIP archive.

## Design

- Use the existing Lab-only `derivePlanetPreviewForType` path so every requested type
  is represented without changing canonical NFT metadata generation.
- Create one random, valid generator input per type using the Lab's existing input
  shape: ticket ID, drawing ID, five unique normal balls, bonus ball, and origin
  transaction hash.
- Render each preview with the shared `renderPlanetGif` implementation at its native
  128x128 logical resolution.
- Write files with stable type-based names in `artifacts/megaplanets-season1-10-types/`
  and create `artifacts/megaplanets-season1-10-types.zip` containing exactly those ten
  GIFs.

## Validation

- Confirm all ten configured Season 1 type IDs are present exactly once.
- Confirm each file begins with the GIF signature and has non-zero size.
- Confirm the ZIP contains exactly ten `.gif` entries and no unrelated files.
- Run the planet-generator test suite after generation; do not run deployment,
  wallet, RPC, or on-chain actions.

## Scope boundary

This is a local visual export only. It does not alter the Lab, canonical generator,
metadata, contract, frontend behavior, or production assets.
