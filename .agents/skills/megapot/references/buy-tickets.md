# Buy one custom ticket

Source: https://llms.megapot.io/tasks/buy-tickets

MegaPlanets Stage 2 uses `Jackpot.buyTickets` for one immediate custom ticket.

```solidity
function buyTickets(
  Ticket[] _tickets,
  address _recipient,
  address[] _referrers,
  uint256[] _referralSplit,
  bytes32 _source
) returns (uint256[] ticketIds)
```

Each ticket contains exactly five unique ascending normal balls and one non-zero
bonus ball. Validate against the active drawing's `ballMax` and `bonusballMax`.
The direct call supports at most ten tickets, but MegaPlanets intentionally limits
the MVP UI to one.

Purchase sequence:

1. Read the active drawing ID and drawing state.
2. Validate the ticket locally.
3. Read USDC allowance and approve the exact ticket price when needed.
4. Simulate and submit `buyTickets` with the complete Jackpot ABI.
5. Wait for the receipt and decode `TicketPurchased`.
6. Persist the emitted `userTicketId`; do not infer it from counters.

Quick-pick in MegaPlanets generates a valid complete ticket client-side and then
uses the same direct purchase path. The protocol also provides
`JackpotRandomTicketBuyer`, but mixing purchase paths is outside the single-ticket MVP.

Key errors include `InvalidBonusball`, `InvalidNormalsCount`, `InvalidTicketCount`,
`TicketPurchasesDisabled`, `JackpotLocked`, `TooManyReferrers`, and `EmergencyEnabled`.
