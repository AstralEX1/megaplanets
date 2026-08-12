# MegaPlanets

MegaPlanets is a Base Sepolia MVP built on the Megapot protocol. A user buys a
Megapot ticket, reveals a deterministic collectible Planet, and earns off-chain minerals
for the weekly leaderboard.

The repository contains working local implementations for direct and keeper bulk ticket
purchases, canonical receipt provenance, deterministic animated Planet generation,
voucher-backed individual and batch minting, PostgreSQL indexing, passive mining,
same-Type bonuses, and weekly leaderboards.

The product is not ready for public testnet release. The seasonless ERC721A V2 is deployed
and verified on Base Sepolia, but checked-in runtime defaults remain disabled and the
production API, database, indexer, monitoring, and broader end-to-end coverage are still
pending. Historical V1 deployments are no longer supported. See the [current development
status](docs/STATUS.md) before enabling minting or deploying services.

## Requirements

- Node.js 22 or newer
- pnpm 11 or newer
- An injected EVM wallet for the default local wallet flow

## Local development

```bash
cp .env.example .env.local
pnpm install
pnpm db:generate
pnpm dev
```

For a production-like local split, run the API and finalized indexer separately:

```bash
pnpm api:server
pnpm api:indexer
```

The standalone API defaults to `127.0.0.1:8787`; Vite remains the frontend dev server.
Check `/api/planets/health`, `/api/planets/readiness`, and `/api/planets/metrics` before
using a configured environment.

The example environment targets Base Sepolia and includes the approved public MegaPlanets
referrer. Override it only for an explicitly approved test or deployment configuration.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:validate
```

## Project documentation

- [Current development status](docs/STATUS.md)
- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Technical decisions](docs/DECISIONS.md)
- [Delivery roadmap](docs/ROADMAP.md)

## Current scope

The Play page supports direct purchases of one to ten tickets and all-random keeper bulk
orders of eleven to fifty tickets. It stores receipt-confirmed `TicketPurchased` data
locally and My Planets validates indexed wallet history plus a bounded recent-chain window
against canonical receipts. Ticket transfers remain outside the voucher-service
eligibility scope: vouchers are bound to the original `TicketPurchased` recipient and the
contract additionally requires that recipient to own the live ticket at mint time.

## License

MIT. The imported Megapot starter kit license is preserved in [LICENSE](LICENSE).
