# Architecture decisions

These are the active decisions. Superseded implementation plans remain only in git
history and must not be used as current requirements.

| ID | Decision | Reason |
| --- | --- | --- |
| D-001 | Base Sepolia only for the MVP | Enables a complete demo without mainnet risk. |
| D-002 | `MEGAPLANETS_V1` is the permanent ticket source tag for this product | Preserves Megapot attribution while keeping the unsupported V1 NFT contract out of the active path. |
| D-003 | Direct checkout is 1–10 tickets; 11–50 uses the facilitator with all-random tickets | Matches Megapot route limits and keeps the game loop small. |
| D-004 | Ticket purchase and Planet mint are separate transactions | Megapot remains the ticket issuer; MegaPlanets owns the Planet collection. |
| D-005 | The seasonless ERC721A V2 is non-upgradeable and uses sequential Planet IDs with bidirectional ticket mappings | Keeps provenance and duplicate protection on-chain with a small trust surface. |
| D-006 | Eligibility is a confirmed receipt-verified Megastera Proof | The Data API is eventually consistent and cannot authorize a mint. |
| D-007 | The canonical seed includes generator version, ticket data, and origin transaction hash | Identical lottery picks remain distinct and reproducible. |
| D-008 | Metadata and media are immutable artifacts | IPFS pointers and hashes remain stable after a voucher is signed. |
| D-009 | The API signs constrained EIP-712 vouchers; the contract rechecks live ticket ownership | The server controls deterministic metadata while the chain enforces recipient, expiry, and one-ticket-one-Planet rules. |
| D-010 | Current Planet holdings come from direct ERC721A reads | Ownership is authoritative on-chain and does not depend on supply caps or an eventually consistent index. |
| D-011 | The projector is finalized PlanetMinted/Transfer only | It supplies mint time, indexed traits, current-owner compatibility reads, and operational replay state without reconstructing Ticket history. |
| D-012 | Mining is `baseMineralsPerDay × elapsed since mintedAt` | It is immutable, lazy, transfer-simple, and gives the current owner the full lifetime value. Burns exclude a Planet from current-owner reads. |
| D-013 | The leaderboard is one PostgreSQL snapshot per completed UTC day | It is deterministic and operationally bounded; a worker owns mutation and public routes read only. |
| D-014 | New runtime media is a bounded short VP8 WebM | It is smaller and better suited to the game UI; GIFs remain immutable regression fixtures. |
| D-015 | USDC approval is route-specific unlimited allowance after an exact allowance check | Avoids repeated signatures while making the spender-risk trade-off explicit. |
| D-016 | Runtime activation is environment-only | The checked-in repository cannot accidentally point at a deployed contract or contain secrets. |
| D-017 | Split API CORS is an explicit exact-origin allowlist | Same-origin remains zero-config; public deployments cannot silently become wildcard credential surfaces. |

## Deployed identity record

The active V2 record is Base Sepolia (`84532`), contract
`0x7a29bfD9d1A7a243A212d4E81bc9A52bE50fb9f2`, deployment transaction
`0xe29aa681e25ba222df04a1acdb2d2e48d2c47ac7cc1d46da0f2e8920ea9f9b6c`, and block
`45347860`. The owner, metadata signer, and approved referrer are
`0xCfc1044C749fD40E07FE33938414Fa573993F857`; the Megapot ticket NFT is
`0x45084829ac63f9dC6a3D4981A46FA896f9180ECd`.

## Deferred, not implied

Mainnet, special editions, on-chain rewards, referral prize pools, and any new retention
mechanic require a separate product decision. They do not justify restoring the removed
accrual/ledger/indexer/auth complexity.
