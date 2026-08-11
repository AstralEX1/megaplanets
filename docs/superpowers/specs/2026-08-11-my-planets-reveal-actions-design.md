# My Planets Reveal Actions Design

## Goal

Make the Planet NFT action read as a reveal rather than a mint, and let a wallet reveal every currently eligible unrevealed Planet from the My Planets collection without changing the existing voucher, simulation, or contract-write logic.

## Scope

- Rename the single-card and selected-detail action from `MINT` to `Reveal`.
- Add a collection-level `Reveal all (X)` action to My Planets.
- Count only unrevealed tickets that have canonical purchase provenance, including a transaction hash and log index.
- Reuse `MintPlanetButton` and `MintPlanetBatchButton`; their internal contract function names remain unchanged.
- Do not change ticket discovery, voucher signing, Planet generation, metadata, or MegaPlanets contract behavior.

## Interaction Design

The collection header displays `Reveal all (X)` when at least two eligible unrevealed Planets exist. A single remaining Planet continues to use its card/detail `Reveal` action rather than showing a redundant collection action.

The existing batch safety limit remains 50 Planets per transaction. When more than 50 Planets remain, the collection action submits the first 50. After the receipt succeeds, those ticket IDs are marked revealed locally and the button count updates to the remaining number. For example, 68 eligible Planets are processed as 50 and then 18, with a separate wallet confirmation for each transaction.

The button label always reports the total number still eligible for reveal, while the surrounding helper copy explains the next batch size when the remaining count exceeds 50. The UI does not claim that multiple wallet transactions are automatic.

## Data and State

My Planets already derives an inventory by merging local purchase receipts, canonical recent on-chain recovery, Data API history, and indexed Planet ownership. The page will derive `revealableItems` from that inventory:

- `revealed` is false;
- the matching ticket has a non-null canonical `originTxHash`;
- the matching ticket has a non-null canonical `logIndex`.

The page passes at most the first 50 revealable previews to the existing batch component. Its success callback adds the returned ticket IDs to `revealedTicketIds`, which updates cards, detail state, the collection count, and the next batch without replacing backend/indexer confirmation.

## Error and Loading Behavior

- Voucher preparation, wallet submission, receipt loading, and contract errors continue through the existing batch component and `TxStatus`.
- The collection action is disabled while its current batch is preparing, awaiting signature, or confirming.
- If only some tickets have canonical provenance, only those tickets are included and counted.
- A failed batch leaves its Planets unrevealed and can be retried.
- No hidden background transaction starts after a successful batch; the user explicitly confirms each remaining batch.

## Responsive Placement

On desktop, `Reveal all (X)` sits beside the Sort control in the My Planets collection header. On mobile, the controls wrap without reducing the collection width or changing the existing full-page detail behavior.

## Verification

- A regression test verifies that unrevealed cards and detail use `Reveal`, never `MINT`.
- A regression test verifies that the collection action counts only eligible unrevealed Planets.
- A regression test verifies that 68 Planets pass only the first 50 to one batch and update to 18 after the success callback.
- Existing single reveal, ticket privacy, selection, sorting, wallet, and responsive tests remain green.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Verify My Planets at desktop and mobile widths, then leave the local site running.
