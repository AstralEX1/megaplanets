# Technical Decisions

## Accepted decisions

| ID | Decision | Rationale |
| --- | --- | --- |
| D-001 | Base Sepolia only for MVP | Allows end-to-end testing without production funds. |
| D-002 | Start from the official Megapot starter kit | Preserves known-good contract, wallet, and Data API patterns. |
| D-003 | One ticket per MVP purchase | Keeps the first Planet eligibility and mint path simple. |
| D-004 | Separate ticket purchase and Planet mint transactions | Megapot remains the ticket issuer; MegaPlanets owns its ERC-721. |
| D-005 | Ticket ID is the Planet token ID | Makes provenance and duplicate protection easy to inspect. |
| D-006 | Generator seed includes ticket ID | Identical picks in one drawing still produce unique planets. |
| D-007 | IPFS metadata is immutable at mint | Keeps token metadata independent of application hosting. |
| D-008 | Backend signs canonical metadata vouchers | Prevents users from substituting arbitrary GIFs or attributes. |
| D-009 | Only `MEGAPLANETS_V1` purchases after launch qualify | Excludes legacy and third-party Megapot tickets. |
| D-010 | Burned eligible tickets may mint later | The indexer preserves the eligible owner at burn time. |
| D-011 | Daily points follow current Planet ownership | Transferable NFTs transfer future leaderboard earning power. |
| D-012 | Vercel + Supabase + Pinata | Minimizes MVP infrastructure operations. |
| D-013 | No upgradeable NFT proxy | Reduces contract complexity and trust surface. |
| D-014 | Generator v1 uses Keccak-256 of standard ABI encoding | Gives browser, backend, and Solidity tooling one unambiguous seed representation. |
| D-015 | Generator random streams are namespaced | Artwork changes cannot accidentally change points or unrelated traits. |
| D-016 | Planet media is a 512×512 pixel-art GIF | A 128×128 logical canvas preserves the source aesthetic while 4× scaling fits NFT media surfaces. |
| D-017 | Stage 3 gallery reads local confirmed purchases only | Avoids treating unrelated wallet tickets as eligible before the Stage 5 indexer exists. |

## Deferred decisions

- Final palette tables and additional noise modes.
- Final points and rarity balancing.
- Rules and artwork for 1/1 special editions.
- Base mainnet launch configuration.
- On-chain weekly reward distribution.
- Base Account batching and gas sponsorship.
