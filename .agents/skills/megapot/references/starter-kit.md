# Starter kit orientation

Source: https://llms.megapot.io/starter-kit

The imported starter kit is the known-good React, wagmi, viem, RainbowKit, and
TanStack Query implementation companion to the protocol skills.

- `src/config/contracts.ts`: chain-resolved addresses and attribution.
- `src/config/wagmi.ts`: wallet connectors and transport.
- `src/hooks/useJackpotState.ts`: lifecycle-aware reads and event invalidation.
- `src/hooks/useBuyTickets.ts`: direct purchase write.
- `src/pages/Play.tsx`: purchase orchestration.
- `src/lib/api.ts`: typed historical Data API client and query keys.

Follow existing exact-allowance, bigint, error-state, and query invalidation
patterns. Protocol semantics come from the official task skills; the starter kit
is the implementation pattern.
