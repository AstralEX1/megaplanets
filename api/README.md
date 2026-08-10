# API

This directory contains the Stage 5 server-side boundary:

- strict server-only environment validation;
- decoding of canonical `MEGAPLANETS_V1` purchase logs;
- deterministic metadata/GIF preparation and Pinata upload helpers;
- EIP-712 mint-voucher signing helpers; and
- a rate-limited voucher endpoint with in-flight request coalescing;
- a local durable JSON eligibility/voucher store; and
- persisted, reproducible daily score reports; and
- a bounded, confirmation-aware indexer function that must be scheduled separately.

The file store is appropriate only for one local process. A production deployment needs
a transactional shared database, durable edge rate limiting, caller proof of wallet
control, and operational scheduling. Ticket transfers are deliberately outside the
current eligibility scope: vouchers remain bound to the original `TicketPurchased` recipient.
Planet NFT transfers are reflected only in the owner set at the recorded snapshot block.
The indexer and snapshot job are never auto-started by the HTTP server. Do not expose a
metadata signer private key to the browser.
