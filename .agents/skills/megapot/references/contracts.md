# Contract reference snapshot

Source: https://llms.megapot.io/contracts/reference

## Base Sepolia

| Contract | Address |
| --- | --- |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Jackpot | `0x465dA3c859f193A3807386387bEE941B2A4c3279` |
| JackpotTicketNFT | `0x45084829ac63f9dC6a3D4981A46FA896f9180ECd` |
| BatchPurchaseFacilitator | `0x62A5D60F486D01a28071652a7951Aff1EA4c5b7c` |
| JackpotAutoSubscription | `0x6d589a1C65A937c25DA3F402C69F7C5d4FcbF053` |
| JackpotLPManager | `0x36408921aB820305F109150003C0F90aE1CB1766` |
| GuaranteedMinimumPayoutCalculator | `0xE9542aC6FaDC47be2Bc42Fc075c1f481529D28cB` |

Always re-check the official reference before deployment.

## Purchase event

```solidity
event TicketPurchased(
  address indexed recipient,
  uint256 indexed currentDrawingId,
  bytes32 indexed source,
  uint256 userTicketId,
  uint8[] normals,
  uint8 bonusball,
  bytes32 referralScheme
);
```

MegaPlanets eligibility later requires the canonical event source to equal the
32-byte padded `MEGAPLANETS_V1` value and the event block to be no earlier than
the configured launch block.

## Ticket ownership and data

`JackpotTicketNFT` exposes `ownerOf`, `getTicketInfo`, and
`getExtendedTicketInfo`. Winnings claims burn the ticket, so late Planet mint
eligibility must be reconstructed from indexed purchase, transfer, and burn events.
