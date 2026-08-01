# MegaPlanets MVP Product Specification

## Product loop

1. A user connects a wallet on Base Sepolia.
2. The user manually selects one Megapot ticket or uses quick-pick.
3. The user approves the exact USDC amount and purchases the ticket through
   MegaPlanets with source `MEGAPLANETS_V1`.
4. The eligible current ticket owner requests deterministic planet metadata.
5. The owner submits a separate transaction to mint one transferable Planet NFT.
6. The current Planet NFT owner earns its generated points at each daily UTC snapshot.
7. The weekly leaderboard allocates the complete referral reward pool in proportion
   to accumulated points.

## MVP boundaries

- Base Sepolia only.
- Exactly one ticket per purchase.
- Manual selection and quick-pick.
- One Planet NFT per eligible Megapot ticket.
- Only tickets purchased through MegaPlanets after the launch block are eligible.
- Planet metadata is an immutable IPFS GIF and JSON document.
- Leaderboard and reward calculations are off-chain.
- No LP, subscriptions, bulk purchase, batch mint, real reward claim, or active 1/1
  special editions.

## Planet identity

The deterministic seed includes generator version, ticket ID, drawing ID, normal
balls, and bonus ball. The bonus ball selects a palette through configurable weighted
distributions. Generator details are implemented and versioned in Stage 3.

## Points and rarity

The drawing ID is the maximum point value for a planet minted from that drawing.
Rarity is derived from the generated daily point value:

| Rarity | Daily points |
| --- | --- |
| Common | 1–100 |
| Uncommon | 101–250 |
| Rare | 251–499 |
| Legendary | 500–`drawingId - 1` |
| 42 | exactly `drawingId` |

Initial selection weights are 72%, 20%, 7%, 0.99%, and 0.01%. Missing ranges are
removed and remaining weights are normalized. Values remain versioned configuration
because balancing is intentionally deferred.

## Success criteria

- A public user can complete the full ticket-to-planet flow on Base Sepolia.
- Planet output is reproducible from canonical ticket data.
- Duplicate Planet mint is impossible.
- Live and burned eligible ticket ownership is resolved correctly.
- Daily ownership snapshots and weekly allocation math are reproducible and auditable.
