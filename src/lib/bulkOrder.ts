import { type Address, type Hex, parseAbi, parseEventLogs, type TransactionReceipt } from 'viem';
import { BATCH_PURCHASE_FACILITATOR_ADDRESS, TICKET_SOURCE } from '@/config/contracts';

export const batchOrderAbi = parseAbi([
  'function minimumTicketCount() view returns (uint256)',
  'function hasActiveBatchOrder(address _recipient) view returns (bool)',
  'function createBatchOrder(address _recipient, uint64 _dynamicTicketCount, (uint8[] normals, uint8 bonusball)[] _userStaticTickets, address[] _referrers, uint256[] _referralSplit, bytes32 _source)',
  'function cancelBatchOrder()',
  'function getBatchOrderInfo(address _recipient) view returns ((uint256 orderDrawingId, uint64 remainingUSDC, uint64 remainingTickets, uint64 totalTicketsOrdered, uint64 dynamicTicketCount, address[] referrers, uint256[] referralSplit) batchOrder, (uint8[] normals, uint8 bonusball)[] staticTickets)',
  'event BatchOrderCreated(address indexed payer, address indexed recipient, uint256 indexed drawingId, uint256 totalCost, uint256 dynamicTicketCount, uint256 staticTicketCount, bytes32 source)',
  'event BatchOrderExecuted(address indexed user, uint256 indexed drawingId, uint256[] ticketIds, uint256 ticketsExecuted, uint256 remainingTickets, uint256 remainingUSDC)',
  'event BatchOrderCancelled(address indexed recipient, uint8 indexed executionAction, uint256 refundAmount)',
  'error ActiveBatchOrderExists()',
  'error NoActiveBatchOrder()',
  'error InvalidTicketCount()',
  'error InvalidStaticTicket()',
  'error InvalidNormalBallCount()',
  'error JackpotLocked()',
  'error JackpotNotInitialized()',
]);

export type PersistedBulkOrder = {
  schemaVersion: 1;
  creationTxHash: Hex;
  drawingId: bigint;
  totalCost: bigint;
  dynamicTicketCount: bigint;
  staticTicketCount: bigint;
  createdAt: string | null;
};

const BULK_ORDER_PREFIX = 'megaplanets:bulk-order:';
const bytes32Pattern = /^0x[\da-fA-F]{64}$/;

type BulkOrderStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readCreatedBulkOrder(
  receipt: TransactionReceipt,
  expectedRecipient: Address,
): PersistedBulkOrder {
  if (!bytes32Pattern.test(receipt.transactionHash)) {
    throw new RangeError('Batch order receipt transaction hash is invalid.');
  }
  const event = parseEventLogs({
    abi: batchOrderAbi,
    eventName: 'BatchOrderCreated',
    logs: receipt.logs.filter(
      (log) => log.address.toLowerCase() === BATCH_PURCHASE_FACILITATOR_ADDRESS.toLowerCase(),
    ),
    strict: false,
  }).find(
    (candidate) =>
      candidate.args.recipient?.toLowerCase() === expectedRecipient.toLowerCase() &&
      candidate.args.source?.toLowerCase() === TICKET_SOURCE.toLowerCase(),
  );
  if (!event) throw new RangeError('Receipt contains no MegaPlanets BatchOrderCreated event.');

  const drawingId = event.args.drawingId;
  const totalCost = event.args.totalCost;
  const dynamicTicketCount = event.args.dynamicTicketCount;
  const staticTicketCount = event.args.staticTicketCount;
  if (
    drawingId === undefined ||
    drawingId <= 0n ||
    totalCost === undefined ||
    totalCost <= 0n ||
    dynamicTicketCount === undefined ||
    staticTicketCount === undefined
  ) {
    throw new RangeError('BatchOrderCreated event is incomplete.');
  }
  return {
    schemaVersion: 1,
    creationTxHash: receipt.transactionHash,
    drawingId,
    totalCost,
    dynamicTicketCount,
    staticTicketCount,
    createdAt: new Date().toISOString(),
  };
}

function storageKey(account: Address) {
  return `${BULK_ORDER_PREFIX}${account.toLowerCase()}`;
}

export function persistBulkOrder(
  account: Address,
  order: PersistedBulkOrder,
  storage: BulkOrderStorage = window.localStorage,
) {
  storage.setItem(
    storageKey(account),
    JSON.stringify({
      ...order,
      drawingId: order.drawingId.toString(),
      totalCost: order.totalCost.toString(),
      dynamicTicketCount: order.dynamicTicketCount.toString(),
      staticTicketCount: order.staticTicketCount.toString(),
    }),
  );
}

export function readPersistedBulkOrder(
  account: Address,
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): PersistedBulkOrder | null {
  const raw = storage.getItem(storageKey(account));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.schemaVersion !== 1 ||
      typeof value.creationTxHash !== 'string' ||
      !bytes32Pattern.test(value.creationTxHash) ||
      typeof value.drawingId !== 'string' ||
      typeof value.totalCost !== 'string' ||
      typeof value.dynamicTicketCount !== 'string' ||
      typeof value.staticTicketCount !== 'string'
    ) {
      return null;
    }
    const order = {
      schemaVersion: 1 as const,
      creationTxHash: value.creationTxHash.toLowerCase() as Hex,
      drawingId: BigInt(value.drawingId),
      totalCost: BigInt(value.totalCost),
      dynamicTicketCount: BigInt(value.dynamicTicketCount),
      staticTicketCount: BigInt(value.staticTicketCount),
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : null,
    };
    if (
      order.drawingId <= 0n ||
      order.totalCost <= 0n ||
      order.dynamicTicketCount < 0n ||
      order.staticTicketCount < 0n
    ) {
      return null;
    }
    return order;
  } catch {
    return null;
  }
}

export function clearPersistedBulkOrder(
  account: Address,
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
) {
  storage.removeItem(storageKey(account));
}
