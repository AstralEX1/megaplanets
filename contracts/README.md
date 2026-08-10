# Contracts

# MegaPlanets contracts

`MegaPlanets` is the ERC721A-based V2 implementation prepared for a clean Base
Sepolia deployment. The already deployed non-upgradeable ERC-721 V1 is retained
as `src/MegaPlanetsV1.sol` for migration reference and is not modified.

## Local commands

```sh
cd contracts
forge test
forge build
forge inspect MegaPlanets abi --json > abi/MegaPlanets.json
```

The pinned dependencies are OpenZeppelin Contracts v5.7.0, ERC721A v4.3.0, and
forge-std v1.16.2. `abi/MegaPlanets.json` is generated from the V2 contract
with Foundry. Regenerate it after every public interface change. The deployment
script is preparation-only; do not use `--broadcast` without explicit
authorization.

## Season 1 and voucher API

Season 1 is immutable and uses `0xee23bca2927e52eeb944320241d7a6e41726dcb3f169d972044bdafe95b4b15b` (`keccak256("MEGAPLANETS_SEASON_1")`). Set the same value in API configuration and `VITE_PLANET_SEASON_ID`.

The EIP-712 domain is `MegaPlanets` / `1`. API signers issue one signature per value of:

```text
MintVoucher(address recipient,uint256 ticketId,bytes32 seasonId,uint256 drawingId,bytes32 originTxHash,bytes32 seed,bytes32 traitsHash,bytes32 metadataHash,string metadataURI,uint256 expiresAt)
```

`mint(voucher, signature)` and `mintBatch(vouchers, signatures)` are nonpayable. The contract checks the current Megapot ticket owner through `JackpotTicketNFT.ownerOf`; a revert indicates a burned or otherwise unavailable ticket.

## Normal Planet mints

- One live eligible Megapot ticket mints one normal Planet.
- ERC721A Planet token IDs are consecutive and start at `1`.
- `planetTokenIdByTicketId(ticketId)` and `ticketIdByPlanetTokenId(tokenId)`
  preserve immutable Megapot provenance.
- `mint` and `mintBatch` are nonpayable. MegaPlanets charges no mint fee; the user pays Base gas only.
- A normal mint verifies an EIP-712 voucher, rejects an already-minted ticket, and checks that the recipient currently owns the live Megapot ticket.
- A batch is atomic: every voucher must be valid, address the same recipient, reference a distinct live ticket, and fit the bounded batch-size limit selected during Stage 4.

Each voucher binds the recipient, ticket ID, Season ID, origin transaction hash, deterministic seed, canonical traits hash, immutable IPFS metadata CID, and expiration. The backend verifies eligibility and canonical generator output before signing; the user cannot substitute metadata or ticket provenance.

## Special editions

Special-edition minting is not part of V2 or the current testnet MVP. Claimed or
burned Megapot tickets are never eligible, including in a batch mint.
