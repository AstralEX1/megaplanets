import { parseAbi, parseEventLogs, type TransactionReceipt } from 'viem';
import { JACKPOT_ADDRESS, TICKET_SOURCE } from '@/config/contracts';

export const jackpotPurchaseAbi = parseAbi([
  'function buyTickets((uint8[] normals, uint8 bonusball)[] _tickets, address _recipient, address[] _referrers, uint256[] _referralSplit, bytes32 _source) returns (uint256[] ticketIds)',
  'event TicketPurchased(address indexed recipient, uint256 indexed currentDrawingId, bytes32 indexed source, uint256 userTicketId, uint8[] normals, uint8 bonusball, bytes32 referralScheme)',
  'error InvalidBonusball()',
  'error InvalidNormalsCount()',
  'error InvalidTicketCount()',
  'error NoTicketsProvided()',
  'error TicketPurchasesDisabled()',
  'error TooManyReferrers()',
  'error JackpotLocked()',
  'error EmergencyEnabled()',
]);

export type PurchasedTicket = {
  ticketId: bigint;
  drawingId: bigint;
  normals: readonly number[];
  bonusBall: number;
};

/** Extract the only MegaPlanets-attributed ticket from a confirmed receipt. */
export function readPurchasedTicket(receipt: TransactionReceipt): PurchasedTicket | null {
  const events = parseEventLogs({
    abi: jackpotPurchaseAbi,
    eventName: 'TicketPurchased',
    logs: receipt.logs.filter((log) => log.address.toLowerCase() === JACKPOT_ADDRESS.toLowerCase()),
    strict: false,
  });
  const event = events.find((candidate) => candidate.args.source === TICKET_SOURCE);
  if (!event?.args.userTicketId || event.args.currentDrawingId === undefined) return null;

  return {
    ticketId: event.args.userTicketId,
    drawingId: event.args.currentDrawingId,
    normals: event.args.normals ?? [],
    bonusBall: event.args.bonusball ?? 0,
  };
}

export function persistPurchasedTicket(account: `0x${string}`, ticket: PurchasedTicket) {
  const key = `megaplanets:purchased-ticket:${account.toLowerCase()}:${ticket.ticketId.toString()}`;
  window.localStorage.setItem(
    key,
    JSON.stringify({
      ticketId: ticket.ticketId.toString(),
      drawingId: ticket.drawingId.toString(),
      normals: ticket.normals,
      bonusBall: ticket.bonusBall,
    }),
  );
}
