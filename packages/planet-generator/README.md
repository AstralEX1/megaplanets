# Planet Generator

`@megaplanets/planet-generator` is the shared Stage 3 implementation used by browser
previews and future server-side metadata generation. It contains no browser globals,
module-level random state, or implicit `Math.random` calls.

## Generator v1

The canonical seed is the Keccak-256 hash of standard Solidity ABI encoding:

```solidity
keccak256(
  abi.encode(
    uint16(1),
    uint256(ticketId),
    uint256(drawingId),
    uint8[5](ascendingNormals),
    uint8(bonusBall)
  )
)
```

Inputs require positive uint256 ticket and drawing IDs, five unique uint8 normal balls,
and a positive uint8 bonus ball. Normal balls are sorted before encoding. Named streams
derived from the seed independently control palette, terrain, satellites, background,
and rarity so one subsystem cannot consume another subsystem's randomness.

The v1 descriptor contains the seed, daily points, rarity, canonical traits JSON, and
traits hash. Traits cover palette and colors, noise mode, planet size and lap time,
clouds, ring/satellites, star count, and a disabled `specialEditionId: null` reservation.

## Palettes and rarity

The six palette types retain the source generator's base weights
`[15, 10, 6, 4, 1, 6]`. A bonus ball chooses one of six rotated weight profiles; the
full seed then selects within that profile. This makes palette choice weighted and
bonus-ball-dependent without creating a direct bonus-ball-to-palette mapping.

Rarity starts at Common 72%, Uncommon 20%, Rare 7%, Legendary 0.99%, and `42` 0.01%.
Ranges above `drawingId - 1` are removed and the remaining weights are normalized.
Rarity `42` always awards exactly `drawingId` points.

## Rendering and extension points

The renderer builds a 128×128 logical pixel scene and nearest-neighbor upscales it to a
512×512 GIF. The default output is 144 frames over twelve seconds with an infinite
loop, a fixed palette, and no dithering. Planet, cloud, and satellite speeds are each
quantized to the nearest whole number of revolutions within that twelve-second window.
This preserves visible speed differences while returning every animated layer to its
exact starting phase at the loop boundary. Satellite front/back ordering follows the
source generator and changes only when an orbit crosses its horizontal axis.
Satellites use a dedicated, high-saturation two-color palette that is selected for
contrast against the generated terrain and clouds; Earth palettes retain the source
generator's warm yellow/orange satellite family.
`GENERATOR_CONFIG_V1` is immutable; palette, noise, animation, or balance changes
require a new generator version and new golden outputs.

Public entry points are `derivePlanet`, `renderPlanetFrame`, `renderPlanetGif`, the
canonical seed helpers, and JSON-safe descriptor/input serializers. Golden fixtures in
`tests/fixtures` lock three reproducible planets byte-for-byte.
