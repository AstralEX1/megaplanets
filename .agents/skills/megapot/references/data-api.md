# Megapot Data API

Source: https://llms.megapot.io/data-api

Use on-chain RPC for live drawing state, purchase confirmation, and all writes.
Use the Data API for historical rounds, wallet tickets, wins, and aggregate stats.

The starter kit contains the typed client in `src/lib/api.ts`. It supports:

- Anonymous access for local development.
- A browser API key for a higher read-only tier.
- A server-side Hono proxy so a privileged key never reaches the browser.

Do not treat the Data API as immediate purchase confirmation because indexing is
eventually consistent. Confirm the transaction receipt and on-chain event first,
then invalidate the relevant query keys while the API catches up.
