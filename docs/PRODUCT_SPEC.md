# MegaPlanets MVP Product Specification

## Product loop

1. A user connects a wallet on Base Sepolia.
2. The user chooses one or more Megapot tickets manually or with quick-pick.
3. MegaPlanets approves the exact USDC total and purchases up to ten tickets in one Megapot transaction with source `MEGAPLANETS_V1`.
4. Every eligible live ticket produces one deterministic Planet identity for Season 1.
5. The current ticket owner requests one or more free Planet mints. The user pays Base transaction gas only; MegaPlanets charges no application-level mint fee.
6. The current Planet owner earns a collection score at each daily UTC snapshot.
7. The final weekly leaderboard allocates the Season 1 referral reward pool by score.

## MVP boundaries

- Base Sepolia only.
- A purchase may contain one to ten custom tickets; there is no grouping into sets.
- One Planet NFT per eligible Megapot ticket.
- Only tickets purchased through MegaPlanets after the launch block are eligible, except for a future explicit integration of verified Megapot referral-bonus tickets.
- A ticket must be live and owned by the minter at mint time. Claimed or burned tickets never mint a Planet.
- Users can mint one Planet or batch mint multiple eligible Planets in one Base transaction.
- Planet metadata is immutable IPFS GIF and JSON.
- Leaderboard and reward calculations are off-chain. MVP payouts are operationally executed and recorded by the project owner; no USDC payout contract is in scope.
- Procedural special editions are disabled. Owner-created 1/1 prize NFTs are minted only after Season 1 finalization.

## Planet identity

Generator v1 and its golden fixtures are immutable historical artifacts. Season 1 uses generator v2, whose canonical seed is:

```text
keccak256(
  abi.encode(
    uint16 generatorVersion,
    bytes32 seasonId,
    uint256 ticketId,
    uint256 drawingId,
    uint8[5] sortedNormals,
    uint8 bonusBall,
    bytes32 originTxHash
  )
)
```

`originTxHash` is the canonical transaction hash of the ticket purchase or verified bonus-ticket claim. Tickets from a batch purchase may share it; unique `ticketId` values still make their Planet identities distinct. `drawingId` is identity data only and does not cap minerals or rarity.

The browser, backend, and tests must use the exact Solidity ABI encoding above. Versioned test vectors lock its seed, traits hash, metadata JSON, and GIF output.

## Planet metadata

Regular Planet metadata exposes these user-facing attributes in this order:

1. Name
2. Type
3. Terrain
4. Satellites
5. Minerals
6. Rarity
7. Season
8. Seed

It also stores ticket ID, drawing ID, and origin transaction hash as audit provenance. `generatorVersion` is technical provenance used by the generator, tests, and backend; it is not a public NFT metadata attribute. Regular metadata sets `specialEditionId` to `null`.

`Type` is the user-facing term for the Planet palette. Season 1 will have exactly ten Types. The bonus ball selects a configurable weighted Type profile, then the seed selects the actual Type within that profile. A bonus ball never maps directly to one Type.

Name, terrain, satellites, background, and other renderer traits use independent named streams from the same deterministic seed. Only Type affects collection scoring.

## Minerals and rarity

Minerals are the Planet's immutable base points. Rarity is a descriptive classification of minerals and never applies an additional points multiplier.

| Rarity | Initial weight | Minerals |
| --- | ---: | ---: |
| Common | 70% | 10–39 |
| Uncommon | 20% | 40–79 |
| Epic | 9% | 80–159 |
| Legendary | 1% | 160–320 |

Generation is hierarchical: select a rarity, select a weighted subrange inside its configured range, then select an integer minerals value. All ranges and weights are versioned Season 1 configuration. Future balancing creates a new configuration and never changes historical Planet metadata.

## Collection score

At a snapshot, each wallet's Type score is:

```text
typeScore = floor(sum(minerals for Type) × typeMultiplierBps / 10_000)
collectionScore = floor(sum(typeScore for all Types) × diversityMultiplierBps / 10_000)
```

The Type multiplier applies to all planets of that Type owned by the wallet:

| Planets of one Type | Multiplier |
| --- | ---: |
| 1–2 | 1.00× |
| 3–5 | 1.15× |
| 6–8 | 1.40× |
| 9–11 | 1.80× |
| 12+ | 2.30× |

The diversity multiplier is deliberately secondary: one Type is 1.00×; two through nine Types add 1% per additional Type; ten Types are 1.10×. Type thresholds and diversity weights are configurable Season rules.

## Seasons, transfers, and rewards

Season 1 lasts about one week. Its eligible ticket interval, snapshot schedule, and finalization time are immutable configuration defined by drawing IDs and drawing lifecycle boundaries before the season starts.

At every daily UTC snapshot, the backend snapshots all current MegaPlanets holders at a recorded Base block, reads each held token's immutable metadata, and calculates the collection score. A transfer before the snapshot gives future score and collection bonuses to the new owner; a transfer after it applies from the next snapshot. Stored snapshot input rows and results make every leaderboard calculation reproducible.

The weekly score is the sum of daily collection scores. The referral reward pool is split proportionally to weekly score in USDC base units. At season end, the owner finalizes the leaderboard, records payouts, and manually mints/distributes selected 1/1 prize NFTs.

## Success criteria

- A public user can complete a batch ticket-to-Planet flow on Base Sepolia.
- Planet output is reproducible from canonical ticket and origin transaction data.
- Duplicate and claimed-ticket mints are impossible.
- Batch minting verifies every live ticket owner and never charges an application mint fee.
- Daily snapshots, weekly scores, and referral allocations are reproducible and auditable.
