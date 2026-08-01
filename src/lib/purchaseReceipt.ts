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

export type PersistedPurchasedTicket = PurchasedTicket & {
  schemaVersion: 0 | 1;
  savedAt: string | null;
};

export type PurchasedTicketStorage = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

const PURCHASED_TICKET_PREFIX = 'megaplanets:purchased-ticket:';

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

export function persistPurchasedTicket(
  account: `0x${string}`,
  ticket: PurchasedTicket,
  options: { storage?: PurchasedTicketStorage; savedAt?: string } = {},
) {
  const key = `${PURCHASED_TICKET_PREFIX}${account.toLowerCase()}:${ticket.ticketId.toString()}`;
  const storage = options.storage ?? window.localStorage;
  storage.setItem(
    key,
    JSON.stringify({
      schemaVersion: 1,
      ticketId: ticket.ticketId.toString(),
      drawingId: ticket.drawingId.toString(),
      normals: ticket.normals,
      bonusBall: ticket.bonusBall,
      savedAt: options.savedAt ?? new Date().toISOString(),
    }),
  );
}

function parsePersistedTicket(raw: string): PersistedPurchasedTicket {
  const value = JSON.parse(raw) as Record<string, unknown>;
  const ticketId = BigInt(String(value.ticketId));
  const drawingId = BigInt(String(value.drawingId));
  const normals = value.normals;
  const bonusBall = value.bonusBall;
  if (ticketId <= 0n || drawingId <= 0n)
    throw new RangeError('Stored ticket IDs must be positive.');
  if (
    !Array.isArray(normals) ||
    normals.length !== 5 ||
    new Set(normals).size !== 5 ||
    normals.some(
      (normal) => !Number.isInteger(normal) || Number(normal) < 1 || Number(normal) > 255,
    )
  ) {
    throw new RangeError('Stored ticket normals are invalid.');
  }
  if (!Number.isInteger(bonusBall) || Number(bonusBall) < 1 || Number(bonusBall) > 255) {
    throw new RangeError('Stored bonus ball is invalid.');
  }
  const schemaVersion = value.schemaVersion === 1 ? 1 : 0;
  const savedAt =
    typeof value.savedAt === 'string' && !Number.isNaN(Date.parse(value.savedAt))
      ? value.savedAt
      : null;
  return {
    ticketId,
    drawingId,
    normals: (normals as number[]).map(Number).sort((left, right) => left - right),
    bonusBall: Number(bonusBall),
    schemaVersion,
    savedAt,
  };
}

/** Reads only confirmed MegaPlanets receipts persisted for one wallet in this browser. */
export function readPersistedPurchasedTickets(
  account: `0x${string}`,
  storage: PurchasedTicketStorage = window.localStorage,
): { tickets: readonly PersistedPurchasedTicket[]; invalidKeys: readonly string[] } {
  const prefix = `${PURCHASED_TICKET_PREFIX}${account.toLowerCase()}:`;
  const tickets: PersistedPurchasedTicket[] = [];
  const invalidKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const raw = storage.getItem(key);
    if (raw === null) continue;
    try {
      tickets.push(parsePersistedTicket(raw));
    } catch {
      invalidKeys.push(key);
    }
  }
  tickets.sort((left, right) => {
    const savedAtOrder =
      (right.savedAt ? Date.parse(right.savedAt) : 0) -
      (left.savedAt ? Date.parse(left.savedAt) : 0);
    if (savedAtOrder !== 0) return savedAtOrder;
    if (left.drawingId !== right.drawingId) return left.drawingId < right.drawingId ? 1 : -1;
    return left.ticketId < right.ticketId ? 1 : left.ticketId > right.ticketId ? -1 : 0;
  });
  return { tickets, invalidKeys };
}
