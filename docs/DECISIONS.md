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
| D-006 | The generator seed includes Season ID and origin transaction hash | Identical picks remain distinct and Season identity is explicit. |
| D-007 | IPFS metadata is immutable at mint | Keeps token metadata independent of application hosting. |
| D-008 | Backend signs canonical individual and batch mint vouchers | Prevents arbitrary attributes while allowing the contract to validate live ownership. |
| D-009 | Normal eligibility requires `MEGAPLANETS_V1` after the launch block | Excludes legacy and unrelated third-party tickets. Verified referral-bonus eligibility is deferred pending Megapot confirmation. |
| D-010 | Claimed or burned tickets never mint | The mint contract verifies that the ticket is live and currently owned by the recipient. |
| D-011 | Lazy mineral production follows current Planet ownership | Transfers settle earned minerals for the previous owner at the transfer timestamp, then start production for the new owner. |
| D-012 | Vercel + Supabase + Pinata | Minimizes MVP infrastructure operations. |
| D-013 | No upgradeable NFT proxy | Reduces contract complexity and trust surface. |
| D-014 | The generator uses Keccak-256 of standard ABI encoding | Browser, backend, and Solidity tooling share one unambiguous seed representation locked by golden fixtures. |
| D-015 | Generator random streams are namespaced | Artwork changes cannot accidentally change minerals or unrelated traits. |
| D-016 | Planet media is a 512×512 pixel-art GIF | A 128×128 logical canvas preserves the source aesthetic while 4× scaling fits NFT media surfaces. |
| D-017 | Stage 3 previews read local confirmed purchases only | Avoids treating unrelated wallet tickets as eligible before the Stage 5 indexer exists. |
| D-018 | Normal Planet minting is free and supports batches | Users pay Base gas only; the contract accepts multiple valid vouchers atomically. |
| D-019 | Same-Type Planet holdings apply configurable, capped production bonuses | This is the only MVP collection-combination mechanic. |
| D-020 | No special-edition minting in the MVP | The collection contract is intentionally limited to ticket-backed procedural Planets. |
| D-021 | Public metadata uses Type and omits generator version | Metadata attributes order Season before Seed; generator version is internal-only. |
| D-022 | Each bonus-ball Type profile weights its matching Type 55% and every other Type 5% | Preserves meaningful bonus-ball affinity while allowing every Season 1 Type to mint from every ticket. |

## Deferred decisions

- Final roster and artwork configuration for ten Types.
- Final minerals subrange weights.
- Exact Season 1 drawing boundaries, mint deadline, production rates, and same-Type bonus thresholds.
- Whether Megapot's referral-bonus campaign can be verified for `MEGAPLANETS_V1` purchases.
- Referral prize pools and on-chain reward claims.
- Base mainnet launch configuration.
- Automated on-chain weekly reward distribution.
