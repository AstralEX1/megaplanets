# Contracts

Stage 4 will initialize a Foundry project here and implement a non-upgradeable `MegaPlanets` ERC-721. No contract code is part of the repository foundation.

## Normal Planet mints

- One live eligible Megapot ticket mints one normal Planet.
- The normal Planet token ID equals the Megapot ticket ID.
- `mint` and `mintBatch` are nonpayable. MegaPlanets charges no mint fee; the user pays Base gas only.
- A normal mint verifies an EIP-712 voucher, rejects an already-minted ticket, and checks that the recipient currently owns the live Megapot ticket.
- A batch is atomic: every voucher must be valid, address the same recipient, reference a distinct live ticket, and fit the bounded batch-size limit selected during Stage 4.

Each voucher binds the recipient, ticket ID, Season ID, origin transaction hash, deterministic seed, canonical traits hash, immutable IPFS metadata CID, and expiration. The backend verifies eligibility and canonical generator output before signing; the user cannot substitute metadata or ticket provenance.

## Special editions

Procedural generation cannot create a special edition. Owner-only `mintSpecial` creates manual prize NFTs with separately prepared immutable IPFS metadata. Special token IDs use a namespace disjoint from normal ticket IDs, and regular metadata always has `specialEditionId: null`.

Claimed or burned Megapot tickets are never eligible, including in a batch mint.
