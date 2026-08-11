# Contracts

# MegaPlanets contracts

`MegaPlanets` is the ERC721A-based V2 implementation prepared for a clean Base
Sepolia deployment. It is not deployed as of the current repository audit.

Historical V1 deployments are no longer supported or configured. Their source is retained
as `src/MegaPlanetsV1.sol` only to explain old testnet data during migration; all new work
targets V2.

The historical Base Sepolia address
[`0xa94b947256fa977E63a7970CDf513FDD7632d744`](https://sepolia.basescan.org/address/0xa94b947256fa977E63a7970CDf513FDD7632d744)
was deployed successfully at block `44,999,871` by transaction
[`0x122fdc39c1c91f5388185c2b843e611d76221d1cddfb1004cdcb7868b0e533ff`](https://sepolia.basescan.org/tx/0x122fdc39c1c91f5388185c2b843e611d76221d1cddfb1004cdcb7868b0e533ff),
but its runtime is V1: it exposes `mintSpecial`/`SPECIAL_TOKEN_PREFIX` and lacks the V2
`totalSupply` and ticket-to-Planet mapping selectors. Never configure this address as V2.

## Local commands

```sh
cd contracts
forge test
forge build
forge inspect MegaPlanets abi --json > abi/MegaPlanets.json
```

The pinned dependencies are OpenZeppelin Contracts, ERC721A v4.3.0, and
forge-std v1.16.2. `abi/MegaPlanets.json` is generated from the V2 contract
with Foundry. Regenerate it after every public interface change. The deployment
script is preparation-only; do not use `--broadcast` without explicit
authorization.

## V2 voucher API

The EIP-712 domain is `MegaPlanets` / `2`. API signers issue one signature per value of:

```text
MintVoucher(address recipient,uint256 ticketId,uint256 drawingId,bytes32 originTxHash,bytes32 seed,bytes32 traitsHash,bytes32 metadataHash,string metadataURI,uint256 expiresAt)
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

Each voucher binds the recipient, ticket ID, drawing ID, origin transaction hash, deterministic seed, canonical traits hash, immutable IPFS metadata CID, and expiration. The backend verifies eligibility and canonical generator output before signing; the user cannot substitute metadata or ticket provenance.

## Special editions

Special-edition minting is not part of V2 or the current testnet MVP. Claimed or
burned Megapot tickets are never eligible, including in a batch mint.

## Deployment gate

Before configuring any V2 address, record and verify all of the following together:

- deployment transaction and block;
- runtime bytecode against the checked-in V2 source and ABI;
- `owner()`, `metadataSigner()`, and `jackpotTicketNFT()`;
- sequential mint and bidirectional provenance behavior on Base Sepolia; and
- matching frontend, API, and indexer configuration.

Until that gate passes, `VITE_MEGAPLANETS_CONTRACT_ADDRESS` and the server-side contract
address/deployment block must remain unset.
