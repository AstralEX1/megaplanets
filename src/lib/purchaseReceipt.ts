import { type Address, type Hex, parseAbi, parseEventLogs, type TransactionReceipt } from 'viem';
import { JACKPOT_ADDRESS, TICKET_SOURCE } from '@/config/contracts';
import { validateTicketPurchasedFields } from '../../shared/ticketValidation';
import { isSuccessfulTransactionReceipt } from './transactionReceipt';

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
  /** The confirmed transaction that actually minted this Megapot ticket. */
  originTxHash: Hex;
  /** The canonical event position within originTxHash. */
  logIndex: bigint;
};

export type PersistedPurchasedTicket = Omit<PurchasedTicket, 'originTxHash' | 'logIndex'> & {
  schemaVersion: 0 | 1 | 2 | 3;
  savedAt: string | null;
  originTxHash: Hex | null;
  logIndex: bigint | null;
};

export type PurchasedTicketStorage = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>;

const PURCHASED_TICKET_PREFIX = 'megaplanets:purchased-ticket:';
const bytes32Pattern = /^0x[\da-fA-F]{64}$/;

export const PURCHASED_TICKETS_UPDATED_EVENT = 'megaplanets:purchased-tickets-updated';

function validateEventTicket(
  event: {
    args: {
      userTicketId?: bigint;
      currentDrawingId?: bigint;
      normals?: readonly number[];
      bonusball?: number;
    };
    logIndex?: bigint | number | null;
  },
  transactionHash: Hex,
): PurchasedTicket {
  const validated = validateTicketPurchasedFields({
    ticketId: event.args.userTicketId,
    drawingId: event.args.currentDrawingId,
    normals: event.args.normals,
    bonusBall: event.args.bonusball,
    logIndex: event.logIndex,
  });
  return { ...validated, originTxHash: transactionHash };
}

/**
 * Decodes every ticket attributable to MegaPlanets in a confirmed receipt.
 * `originTxHash` intentionally belongs to the ticket-minting transaction: for
 * a bulk order this is a keeper execution receipt, not the order-creation receipt.
 */
export function readPurchasedTickets(
  receipt: TransactionReceipt,
  expectedRecipient: Address,
): readonly PurchasedTicket[] {
  if (!isSuccessfulTransactionReceipt(receipt)) {
    throw new Error('Transaction receipt did not succeed.');
  }
  if (!bytes32Pattern.test(receipt.transactionHash)) {
    throw new RangeError('Receipt transaction hash is invalid.');
  }
  const events = parseEventLogs({
    abi: jackpotPurchaseAbi,
    eventName: 'TicketPurchased',
    logs: receipt.logs.filter((log) => log.address.toLowerCase() === JACKPOT_ADDRESS.toLowerCase()),
    strict: false,
  });
  const recipient = expectedRecipient.toLowerCase();
  const source = TICKET_SOURCE.toLowerCase();
  const matching = events.filter(
    (event) =>
      event.args.source?.toLowerCase() === source &&
      event.args.recipient?.toLowerCase() === recipient,
  );
  if (matching.length === 0) {
    throw new RangeError('Receipt contains no MegaPlanets TicketPurchased events for this wallet.');
  }

  const tickets = matching.map((event) => validateEventTicket(event, receipt.transactionHash));
  const ids = new Set<string>();
  for (const ticket of tickets) {
    const id = ticket.ticketId.toString();
    if (ids.has(id)) throw new RangeError('Receipt contains duplicate MegaPlanets ticket IDs.');
    ids.add(id);
  }
  return tickets.sort((left, right) => (left.logIndex < right.logIndex ? -1 : 1));
}

function storageKey(account: Address, ticketId: bigint) {
  return `${PURCHASED_TICKET_PREFIX}${account.toLowerCase()}:${ticketId.toString()}`;
}

export function persistPurchasedTickets(
  account: Address,
  tickets: readonly PurchasedTicket[],
  options: { storage?: PurchasedTicketStorage; savedAt?: string } = {},
) {
  const storage = options.storage ?? window.localStorage;
  const seen = new Set<string>();
  for (const ticket of tickets) {
    const id = ticket.ticketId.toString();
    if (seen.has(id)) throw new RangeError('Cannot persist duplicate ticket IDs.');
    seen.add(id);
    storage.setItem(
      storageKey(account, ticket.ticketId),
      JSON.stringify({
        schemaVersion: 3,
        ticketId: id,
        drawingId: ticket.drawingId.toString(),
        normals: ticket.normals,
        bonusBall: ticket.bonusBall,
        originTxHash: ticket.originTxHash,
        logIndex: ticket.logIndex.toString(),
        savedAt: options.savedAt ?? new Date().toISOString(),
      }),
    );
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PURCHASED_TICKETS_UPDATED_EVENT, {
        detail: { account: account.toLowerCase() },
      }),
    );
  }
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
  const schemaVersion =
    value.schemaVersion === 3
      ? 3
      : value.schemaVersion === 2
        ? 2
        : value.schemaVersion === 1
          ? 1
          : 0;
  const originTxHash =
    typeof value.originTxHash === 'string' && bytes32Pattern.test(value.originTxHash)
      ? (value.originTxHash.toLowerCase() as Hex)
      : null;
  const logIndex =
    typeof value.logIndex === 'string' && /^\d+$/.test(value.logIndex)
      ? BigInt(value.logIndex)
      : null;
  if (schemaVersion === 3 && (originTxHash === null || logIndex === null)) {
    throw new RangeError('Stored canonical provenance is invalid.');
  }
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
    originTxHash,
    logIndex,
  };
}

/** Reads confirmed MegaPlanets receipts persisted for one wallet in this browser. */
export function readPersistedPurchasedTickets(
  account: Address,
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
