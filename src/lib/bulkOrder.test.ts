import { encodeAbiParameters, encodeEventTopics } from 'viem';
import { describe, expect, it } from 'vitest';
import { BATCH_PURCHASE_FACILITATOR_ADDRESS, TICKET_SOURCE } from '@/config/contracts';
import {
  batchOrderAbi,
  persistBulkOrder,
  readCreatedBulkOrder,
  readPersistedBulkOrder,
} from './bulkOrder';

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const account = '0x1111111111111111111111111111111111111111' as const;
const transactionHash =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;

function createdLog(args: { source?: `0x${string}`; recipient?: `0x${string}` } = {}) {
  const topics = encodeEventTopics({
    abi: batchOrderAbi,
    eventName: 'BatchOrderCreated',
    args: { payer: account, recipient: args.recipient ?? account, drawingId: 123n },
  });
  const data = encodeAbiParameters(
    [
      { type: 'uint256', name: 'totalCost' },
      { type: 'uint256', name: 'dynamicTicketCount' },
      { type: 'uint256', name: 'staticTicketCount' },
      { type: 'bytes32', name: 'source' },
    ],
    [11_000_000n, 1n, 10n, args.source ?? TICKET_SOURCE],
  );
  return { address: BATCH_PURCHASE_FACILITATOR_ADDRESS, topics, data, logIndex: 3 };
}

describe('bulk order receipt provenance', () => {
  it('persists a source-attributed created order separately from ticket provenance', () => {
    const order = readCreatedBulkOrder({ transactionHash, logs: [createdLog()] } as never, account);
    expect(order).toMatchObject({
      schemaVersion: 1,
      creationTxHash: transactionHash,
      drawingId: 123n,
      totalCost: 11_000_000n,
      dynamicTicketCount: 1n,
      staticTicketCount: 10n,
    });
    const storage = new MemoryStorage();
    persistBulkOrder(account, order, storage);
    expect(readPersistedBulkOrder(account, storage)).toEqual(order);
  });

  it('rejects foreign source and recipient events', () => {
    expect(() =>
      readCreatedBulkOrder(
        { transactionHash, logs: [createdLog({ source: `0x${'12'.repeat(32)}` })] } as never,
        account,
      ),
    ).toThrow(/no MegaPlanets/i);
    expect(() =>
      readCreatedBulkOrder(
        {
          transactionHash,
          logs: [createdLog({ recipient: '0x2222222222222222222222222222222222222222' })],
        } as never,
        account,
      ),
    ).toThrow(/no MegaPlanets/i);
  });
});
