# Planet Generator

`@megaplanets/planet-generator` is the canonical deterministic implementation shared by
browser previews and future metadata services. It has no browser globals, module-level
random state, or implicit `Math.random` calls.

## Identity and input encoding

The seed is the Keccak-256 hash of standard Solidity ABI encoding:

```solidity
keccak256(
  abi.encode(
    uint16(generatorVersion),
    uint256(ticketId),
    uint256(drawingId),
    uint8[5](ascendingNormals),
    uint8(bonusBall),
    bytes32(originTxHash)
  )
)
```

`originTxHash` must be a 32-byte hex value. IDs are positive `uint256`
values. Five unique `uint8` normal balls are sorted before encoding. `drawingId` is
identity only and never caps minerals or rarity; `ticketId` keeps tickets from one batch
distinct. Named random streams isolate name, Type, terrain, satellites, minerals, and
visual decisions.

## Traits and metadata

The ten Planet Types are Nebula, Desert, Triplex, Toxic, Void, Gaia, Volcanic, Gas
Giant, Rocky, and Oceanic. Each immutable `TypeVisualProfile` stores the deterministic
palette variants, terrain weights, clouds, satellites, size, and rotation constraints
for exactly one Type. Bonus balls select cyclic profiles in Type-roster order: the
matching Type has a 55% weight and each of the other nine Types has a 5% weight. The
seed then resolves the Type, palette, terrain, and satellites once; the renderer only
consumes those resolved choices. Void intentionally uses the source generator's HSB
Cavity formula rather than fixed swatches.

Names are synthesized from a deterministic phoneme grammar and may receive a Roman or
catalogue suffix. They are not selected from a finite list. Regular procedural planets
always contain `specialEditionId: null`.

Public metadata attributes are ordered exactly as Name, Type, Satellites, Minerals,
Rarity, Seed. Ticket ID, drawing ID, and origin transaction hash,
and traits hash remain audit provenance outside the public attribute list. `Satellites`
is always the numeric number of rendered satellite sprites. For a ring, it is the
number of rendered ring particles; the `hasRing` flag remains an internal canonical
render trait. Terrain is renderer-internal and is not a public attribute.

Rarity is selected first, followed by a configurable weighted mineral subrange and an
integer within that subrange:

| Rarity | Weight | Minerals |
| --- | ---: | ---: |
| Common | 70% | 10–39 |
| Uncommon | 20% | 40–79 |
| Epic | 9% | 80–159 |
| Legendary | 1% | 160–320 |

Rarity is descriptive and never multiplies minerals or score.

## Rendering

The accepted renderer produces a 128×128 animated GIF directly from the logical pixel
scene. The UI uses nearest-neighbor CSS scaling for larger displays, so the stored asset
stays small while retaining its intended pixel-art appearance. The preset contains 144
frames over twelve seconds, loops forever, uses a fixed palette, and does not dither.
Animation speeds are loop-safe while retaining different planet, cloud, and satellite speeds.

Clouds are a separate transparent pixel sphere, four logical pixels larger than the
terrain. The rear hemisphere uses the darker cloud color, allowing cloud pixels to pass
visibly beyond the terrain edge before moving behind it. Satellites use independent,
contrasting colors and source-style front/back orbit ordering.

The visual layer supports simplex, ridged, domain-warped, striped, and gradation terrain.
Pure extension samplers add turbulence, banded, cratered, ocean-current, cellular, and
polar-cap modes. Lab uses the same weighted Type profile as canonical previews, so it
can show every valid terrain variation instead of a fixed first mode. New palette and
terrain behavior belongs in immutable Planet configuration and requires reviewed golden
outputs.

## Integration and verification

Use `derivePlanet` for canonical metadata traits, `derivePlanetPreview` for accepted
animated visuals, and `renderPlanetFrame` or `renderPlanetGif` for output. Serialization
helpers normalize inputs and descriptor deserialization re-derives canonical data before
trusting a supplied seed, traits, or hashes. Workers receive the full serialized input and
derive the seed themselves; arbitrary caller-provided seeds are not accepted.

`derivePlanetPreviewForType` is reserved for the development-only Lab and must never
produce NFT metadata. Production builds omit the Lab route and navigation entry.

Run `pnpm --filter @megaplanets/planet-generator golden` to verify fixtures. Intentional
fixture replacement uses `golden:update` and requires coordinator review.
