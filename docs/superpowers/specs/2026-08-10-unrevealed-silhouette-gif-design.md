# Unrevealed Planet GIF

Create one local 128x128 looping GIF that keeps the existing MegaPlanets animation
cadence while hiding planet traits behind a dark pixel-art silhouette and a centered
question mark.

The export uses an existing generated preview as the animated source, masks the sphere
interior to a near-black blue silhouette, retains a restrained rim glow, and draws a
pixel question mark over the center. It is an export-only artifact: no metadata, Lab,
frontend, contract, or production behavior changes.

Validation checks the GIF signature, native dimensions, non-zero size, and frame count.
