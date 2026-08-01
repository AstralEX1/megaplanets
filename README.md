# MegaPlanets

MegaPlanets is a Base Sepolia MVP built on the Megapot protocol. A user buys a
Megapot ticket, then uses that ticket to mint a deterministic collectible planet.

This repository contains the Stage 3 checkpoint. A user can select numbers manually
or quick-pick exactly one ticket, approve the exact USDC price, and buy through
`Jackpot.buyTickets` on Base Sepolia. Confirmed MegaPlanets tickets can then be viewed
as deterministic 512×512 animated pixel-art Planets. NFT minting, canonical IPFS
metadata, and leaderboard behavior are added in later checkpoints.

## Requirements

- Node.js 22 or newer
- pnpm 11 or newer
- An injected EVM wallet for the default local wallet flow

## Local development

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

The example environment targets Base Sepolia. Before purchasing tickets, replace
the dead referrer address with the public wallet that should receive Megapot
referral fees.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Project documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Technical decisions](docs/DECISIONS.md)
- [Delivery roadmap](docs/ROADMAP.md)

## Current scope

LP, subscriptions, batch orders, and multi-ticket purchases are excluded from the
MegaPlanets checkout. The Play page deliberately permits exactly one ticket per
transaction and stores the confirmed `TicketPurchased` data locally for the connected
wallet. The Stage 3 Planets gallery reads only those local confirmations; the durable
eligibility index arrives in Stage 5.

## License

MIT. The imported Megapot starter kit license is preserved in [LICENSE](LICENSE).
