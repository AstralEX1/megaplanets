# MegaPlanets MVP Product Specification

## Product loop

1. A user connects a wallet on Base Sepolia.
2. The user purchases one or more Megapot tickets through MegaPlanets with source
   `MEGAPLANETS_V1`.
3. Every eligible live ticket receives a deterministic Planet identity and can claim one
   free MegaPlanets NFT.
4. The user claims one Planet or several Planets in a single ERC-721A batch-mint
   transaction, paying Base gas only.
5. Each owned Planet passively produces minerals.
6. Owning multiple Planets of the same Type activates a production bonus.
7. The weekly leaderboard ranks earned minerals.

## MVP boundaries

- Base Sepolia only. Deployment is a separate, explicit approval-gated action.
- Direct purchases support one to ten custom or quick-pick tickets. Keeper bulk orders
  support 11 to 50 all-random tickets.
- One live eligible Megapot ticket can mint exactly one Planet.
- Planet NFTs are a clean ERC-721A V2 collection with sequential Planet token IDs.
- `ticketId -> planetTokenId` and `planetTokenId -> ticketId` mappings provide canonical
  provenance. A Planet token ID is not the Megapot ticket ID.
- Planet metadata is immutable IPFS GIF and JSON.
- The MVP does not include Colonize, XP, colony levels, manual special editions, or
  referral payouts.
- Minerals are permanent off-chain score. Mining, bonuses, and leaderboard calculations
  use fixed-point integer arithmetic.

## Planet identity

V2 uses one canonical generator whose seed is:

```text
keccak256(
  abi.encode(
    uint16 generatorVersion,
    uint256 ticketId,
    uint256 drawingId,
    uint8[5] sortedNormals,
    uint8 bonusBall,
    bytes32 originTxHash
  )
)
```

`originTxHash` is the canonical transaction hash of the ticket purchase. Tickets from a
batch purchase may share it; unique `ticketId` values still make their Planet identities
distinct. The browser, backend, and tests use this exact Solidity ABI encoding. Golden
test vectors lock seed, traits hash, metadata JSON, and GIF output.

## Metadata, minerals, and rarity

Regular Planet metadata exposes Name, Type, Satellites, Minerals, Rarity, and Seed
in that order, with ticket ID, drawing ID, and origin transaction hash retained as audit
provenance. The generator configuration determines immutable base `mineralsPerDay` and
rarity. Rarity is descriptive and does not create a separate production multiplier.

## Mining and same-Type bonuses

The backend calculates pending minerals lazily:

```text
pending = effectiveMineralsPerDay × elapsedSeconds / secondsPerDay
```

All amounts use scaled integers, and any fractional remainder stays in the Planet accrual
state. The backend settles the current production segment before a mint, NFT transfer,
same-Type bonus change, or weekly finalization. Minerals earned before a transfer
remain with the previous owner.

The initial bonus configuration applies to all same-Type Planets owned by one wallet:

| Planets of one Type | Production bonus |
| --- | ---: |
| 1 | +0% |
| 2 | +5% |
| 3 | +10% |
| 4 or more | +15% |

Bonus thresholds, maximum bonus, mineral scale, and rate limits are versioned server
configuration. There is no diversity bonus in the MVP.

## Weekly leaderboard

Weeks run from Monday 00:00 UTC to the following Monday 00:00 UTC. A user's score is the
sum of settled mineral-ledger entries and pending active production segments through
`min(now, periodEnd)`. A finalized week is reproducible from immutable ledger and
rate-segment data and includes historical ranks.

## Success criteria

- A public user can complete a ticket-to-Planet flow on Base Sepolia.
- Individual and ERC-721A batch mints reject duplicate, claimed, burned, or transferred
  tickets.
- Planet provenance, metadata, and artwork are reproducible from canonical ticket data.
- Pending minerals grow without a periodic accrual job and are correctly split on transfer.
- Same-Type ownership changes update production at the correct timestamp.
- A weekly leaderboard ranks earned minerals from canonical rate segments.
