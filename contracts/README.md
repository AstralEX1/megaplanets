# Contracts

# MegaPlanets contracts

Stage 4 provides the non-upgradeable Season 1 `MegaPlanets` ERC-721 for Base Sepolia. It is not deployed by this repository.

## Local commands

```sh
cd contracts
forge test
forge build
forge inspect MegaPlanets abi --json > abi/MegaPlanets.json
```

The pinned dependencies are OpenZeppelin Contracts v5.7.0 and forge-std v1.16.2. The deployment script is preparation-only; do not use `--broadcast` before Stage 6 authorization.

## Season 1 and voucher API

Season 1 is immutable and uses `0xee23bca2927e52eeb944320241d7a6e41726dcb3f169d972044bdafe95b4b15b` (`keccak256("MEGAPLANETS_SEASON_1")`). Set the same value in API configuration and `VITE_PLANET_SEASON_ID`.

The EIP-712 domain is `MegaPlanets` / `1`. API signers issue one signature per value of:

```text
MintVoucher(address recipient,uint256 ticketId,bytes32 seasonId,uint256 drawingId,bytes32 originTxHash,bytes32 seed,bytes32 traitsHash,bytes32 metadataHash,string metadataURI,uint256 expiresAt)
```

`mint(voucher, signature)` and `mintBatch(vouchers, signatures)` are nonpayable. The contract checks the current Megapot ticket owner through `JackpotTicketNFT.ownerOf`; a revert indicates a burned or otherwise unavailable ticket.

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
