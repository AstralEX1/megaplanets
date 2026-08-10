# MegaPlanets

MegaPlanets is a Base Sepolia MVP built on the Megapot protocol. A user buys a
Megapot ticket, then uses that ticket to mint a deterministic collectible planet.

This repository contains the Stage 4 contract checkpoint and Stage 5 voucher-service
groundwork. A user can buy one to ten direct tickets or create an all-random bulk order
for eleven to fifty tickets on Base Sepolia, using exact USDC approvals. Confirmed
MegaPlanets tickets render as deterministic 512x512 animated pixel-art Planets.

Planet minting is intentionally disabled until a server-side voucher service is configured
with `VITE_PLANET_API_BASE_URL`. That service verifies receipt provenance for the original
purchase recipient, pins immutable IPFS media/metadata, and signs the mint voucher. The
repository does not make a claim about a current contract deployment; verify addresses and
the active metadata signer together before enabling minting.

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

The example environment targets Base Sepolia and includes the approved public MegaPlanets
referrer. Override it only for an explicitly approved test or deployment configuration.

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

The Play page supports direct purchases of one to ten tickets and all-random keeper bulk
orders of eleven to fifty tickets. It stores receipt-confirmed `TicketPurchased` data
locally and the Planets gallery additionally scans canonical on-chain purchase events for
the connected original recipient. Ticket transfers are outside the current eligibility
scope: the voucher service remains bound to that original recipient.

## License

MIT. The imported Megapot starter kit license is preserved in [LICENSE](LICENSE).
