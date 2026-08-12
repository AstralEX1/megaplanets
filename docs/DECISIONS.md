# Technical Decisions

## Accepted decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| D-001 | Base Sepolia only for MVP | Allows end-to-end testing without production funds. |
| D-002 | Start from the official Megapot starter kit | Preserves known-good contract, wallet, and Data API patterns. |
| D-003 | A custom purchase supports one to ten tickets | Batch purchases are required for normal play while staying within the Megapot direct-call limit. |
| D-023 | Bulk purchases from 11 to 50 tickets are all-random | MegaPlanets passes the full quantity as facilitator `dynamicTicketCount` and no static picks, matching the simplified MVP checkout. |
| D-004 | Separate ticket purchase and Planet mint transactions | Megapot remains the ticket issuer; MegaPlanets owns a dedicated ERC-721A collection. |
| D-005 | One live eligible ticket mints one Planet with a sequential Planet token ID | ERC-721A batch minting is efficient; bidirectional ticket/Planet mappings preserve provenance and duplicate protection. |
| D-006 | The generator seed includes generator version and origin transaction hash | Identical picks remain distinct while the versioned ABI encoding remains explicit. |
| D-007 | IPFS metadata is immutable at mint | Keeps token metadata independent of application hosting. |
| D-008 | Backend signs canonical individual and batch mint vouchers | Prevents arbitrary attributes while allowing the contract to validate live ownership. |
| D-009 | Normal eligibility requires `MEGAPLANETS_V1` after the launch block | Excludes legacy and unrelated third-party tickets. Verified referral-bonus eligibility is deferred pending Megapot confirmation. |
| D-010 | Claimed or burned tickets never mint | The mint contract verifies that the ticket is live and currently owned by the recipient. |
| D-011 | Lazy mineral production follows current Planet ownership | Transfers settle earned minerals for the previous owner at the transfer timestamp, then start production for the new owner. |
| D-012 | Vercel + Supabase + Pinata | Minimizes MVP infrastructure operations. |
| D-013 | No upgradeable NFT proxy | Reduces contract complexity and trust surface. |
| D-014 | The generator uses Keccak-256 of standard ABI encoding | Browser, backend, and Solidity tooling share one unambiguous seed representation locked by golden fixtures. |
| D-015 | Generator random streams are namespaced | Artwork changes cannot accidentally change minerals or unrelated traits. |
| D-016 | Canonical Planet media is a 128×128 pixel-art GIF | The native logical canvas is pinned without resampling; clients scale it with nearest-neighbor rendering. |
| D-017 | Superseded: early previews read local confirmed purchases only | The current implementation discovers candidates from wallet history plus a bounded recent-chain scan and revalidates canonical receipts. |
| D-018 | Normal Planet minting is free and supports batches | Users pay Base gas only; the contract accepts multiple valid vouchers atomically. |
| D-019 | Same-Type Planet holdings apply configurable, capped production bonuses | This is the only MVP collection-combination mechanic. |
| D-020 | No special-edition minting in the MVP | The collection contract is intentionally limited to ticket-backed procedural Planets. |
| D-021 | Public metadata uses Type and omits generator version | Metadata attributes order the public traits as Name, Type, Satellites, Minerals, Rarity, and Seed. |
| D-022 | Each bonus-ball Type profile weights its matching Type 55% and every other Type 5% | Preserves meaningful bonus-ball affinity while allowing every configured Type to mint from every ticket. |
| D-024 | Historical V1 Planet deployments are unsupported | Active configuration stays empty until an explicitly approved ERC721A V2 deployment passes the deployment gate. |
| D-025 | USDC approvals use unlimited allowance after an exact allowance check | Avoids repeated approval signatures while making the larger spender-risk trade-off explicit; successful approval receipts refetch allowance state. |

## Deferred decisions

- Final product sign-off for the implemented ten-Type roster and artwork configuration.
- Final minerals subrange weights.
- Exact drawing boundaries, mint deadline, and production rates. The initial
  same-Type thresholds are implemented as 0%, 5%, 10%, and 15% for one through four-or-more
  matching Planets.
- Whether Megapot's referral-bonus campaign can be verified for `MEGAPLANETS_V1` purchases.
- Referral prize pools and on-chain reward claims.
- Base mainnet launch configuration.
- Automated on-chain weekly reward distribution.
