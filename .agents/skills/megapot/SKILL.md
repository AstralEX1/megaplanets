---
name: megapot
description: Build and maintain the MegaPlanets integration with the Megapot on-chain lottery on Base. Use for ticket purchases, drawing state, Megapot contract events and addresses, ticket ownership, claims, or the Megapot Data API.
---

# Megapot integration workflow

Use `https://llms.megapot.io/` as the canonical protocol source. The references in
this skill are a repository snapshot for fast orientation; verify remote documentation
before changing signatures, addresses, fees, or lifecycle assumptions.

## Route the task

- Read `references/buy-tickets.md` for custom or quick-pick purchase work.
- Read `references/contracts.md` for addresses, events, ownership, and ABI fragments.
- Read `references/read-state.md` for drawing lifecycle and live UI state.
- Read `references/data-api.md` for historical rounds, wallet history, or indexed reads.
- Read `references/starter-kit.md` before changing frontend integration patterns.

## Project invariants

1. Target Base Sepolia unless the user explicitly authorizes mainnet work.
2. Read ticket price, drawing ID, `ballMax`, `bonusballMax`, fees, and locks dynamically.
3. Pass `MEGAPLANETS_V1` as the `bytes32` source on every ticket purchase.
4. Pass the configured referrer wallet and a referral split totaling exactly `1e18`.
5. Never deploy with the dead referrer placeholder.
6. Approve USDC to the contract that directly pulls it, using the exact required amount.
7. Simulate writes with the matching ABI so custom errors can be decoded.
8. Confirm purchases from the receipt and canonical `TicketPurchased` event before
   treating a ticket as eligible.
9. Keep amounts as bigint and USDC in six-decimal base units.
10. Preserve event-driven invalidation and phase-aware polling from the starter kit.

## Verification

- Re-fetch the relevant official skill page when changing protocol behavior.
- Verify the selected chain ID and all resolved addresses together.
- Test the lock/settlement window and receipt decoding, not only the happy path.
- Run repository lint, typecheck, tests, and build before handing off a stage.

## Canonical sources

- Entry point: https://llms.megapot.io/
- Custom tickets: https://llms.megapot.io/tasks/buy-tickets
- State reads: https://llms.megapot.io/tasks/read-state
- Data API: https://llms.megapot.io/data-api
- Contracts: https://llms.megapot.io/contracts/reference
- Starter kit: https://llms.megapot.io/starter-kit
