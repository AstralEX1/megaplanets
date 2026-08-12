import { encodeAbiParameters, encodeEventTopics, zeroHash } from 'viem';
import { describe, expect, it } from 'vitest';
import { JACKPOT_ADDRESS, TICKET_SOURCE } from '@/config/contracts';
import {
  jackpotPurchaseAbi,
  persistPurchasedTickets,
  readPersistedPurchasedTickets,
  readPurchasedTickets,
} from './purchaseReceipt';

class MemoryStorage {
  readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
}

const account = '0x1111111111111111111111111111111111111111' as const;
const transactionHash =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

function purchaseLog(args: {
  ticketId: bigint;
  drawingId?: bigint;
  recipient?: `0x${string}`;
  source?: `0x${string}`;
  normals?: readonly number[];
  bonusBall?: number;
  logIndex: bigint;
}) {
  const topics = encodeEventTopics({
    abi: jackpotPurchaseAbi,
    eventName: 'TicketPurchased',
    args: {
      recipient: args.recipient ?? account,
      currentDrawingId: args.drawingId ?? 123n,
      source: args.source ?? TICKET_SOURCE,
    },
  });
  const data = encodeAbiParameters(
    [
      { type: 'uint256', name: 'userTicketId' },
      { type: 'uint8[]', name: 'normals' },
      { type: 'uint8', name: 'bonusball' },
      { type: 'bytes32', name: 'referralScheme' },
    ],
    [args.ticketId, args.normals ?? [2, 7, 14, 22, 29], args.bonusBall ?? 9, zeroHash],
  );
  return { address: JACKPOT_ADDRESS, topics, data, logIndex: args.logIndex };
}

describe('readPurchasedTickets', () => {
  it('extracts every MegaPlanets ticket in canonical log order', () => {
    const tickets = readPurchasedTickets(
      {
        status: 'success',
        transactionHash,
        logs: [
          purchaseLog({ ticketId: 457n, logIndex: 8n }),
          purchaseLog({ ticketId: 456n, normals: [29, 2, 22, 7, 14], logIndex: 7n }),
        ],
      } as never,
      account,
    );

    expect(tickets).toEqual([
      {
        ticketId: 456n,
        drawingId: 123n,
        normals: [2, 7, 14, 22, 29],
        bonusBall: 9,
        originTxHash: transactionHash,
        logIndex: 7n,
      },
      {
        ticketId: 457n,
        drawingId: 123n,
        normals: [2, 7, 14, 22, 29],
        bonusBall: 9,
        originTxHash: transactionHash,
        logIndex: 8n,
      },
    ]);
  });

  it('rejects receipts without a matching source and recipient', () => {
    const foreignSource = `0x${'12'.repeat(32)}` as const;
    expect(() =>
      readPurchasedTickets(
        {
          status: 'success',
          transactionHash,
          logs: [purchaseLog({ ticketId: 456n, source: foreignSource, logIndex: 1n })],
        } as never,
        account,
      ),
    ).toThrow(/no MegaPlanets/i);
    expect(() =>
      readPurchasedTickets(
        {
          status: 'success',
          transactionHash,
          logs: [
            purchaseLog({
              ticketId: 456n,
              recipient: '0x2222222222222222222222222222222222222222',
              logIndex: 1n,
            }),
          ],
        } as never,
        account,
      ),
    ).toThrow(/no MegaPlanets/i);
  });

  it('rejects duplicate IDs and incomplete canonical event provenance', () => {
    expect(() =>
      readPurchasedTickets(
        {
          status: 'success',
          transactionHash,
          logs: [
            purchaseLog({ ticketId: 456n, logIndex: 1n }),
            purchaseLog({ ticketId: 456n, logIndex: 2n }),
          ],
        } as never,
        account,
      ),
    ).toThrow(/duplicate/i);
    expect(() =>
      readPurchasedTickets(
        {
          status: 'success',
          transactionHash,
          logs: [{ ...purchaseLog({ ticketId: 456n, logIndex: 1n }), logIndex: undefined }],
        } as never,
        account,
      ),
    ).toThrow(/log index/i);
  });

  it('rejects a reverted receipt before decoding TicketPurchased logs', () => {
    expect(() =>
      readPurchasedTickets(
        {
          status: 'reverted',
          transactionHash,
          logs: [purchaseLog({ ticketId: 456n, logIndex: 1n })],
        } as never,
        account,
      ),
    ).toThrow(/did not succeed/i);
  });
});

describe('confirmed ticket persistence', () => {
  const ticket = {
    ticketId: 456n,
    drawingId: 123n,
    normals: [2, 7, 14, 22, 29],
    bonusBall: 9,
    originTxHash: transactionHash,
    logIndex: 7n,
  };

  it('writes schema v3 records and isolates wallets', () => {
    const storage = new MemoryStorage();
    persistPurchasedTickets(account, [ticket], { storage, savedAt: '2026-08-01T12:00:00.000Z' });
    persistPurchasedTickets(
      '0x2222222222222222222222222222222222222222',
      [{ ...ticket, ticketId: 999n }],
      { storage },
    );

    expect(readPersistedPurchasedTickets(account, storage)).toEqual({
      tickets: [{ ...ticket, schemaVersion: 3, savedAt: '2026-08-01T12:00:00.000Z' }],
      invalidKeys: [],
    });
  });

  it('reads legacy records but marks their log index as incomplete', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      `megaplanets:purchased-ticket:${account}:456`,
      JSON.stringify({
        schemaVersion: 2,
        ticketId: '456',
        drawingId: '123',
        normals: [29, 2, 22, 7, 14],
        bonusBall: 9,
        originTxHash: transactionHash,
      }),
    );
    expect(readPersistedPurchasedTickets(account, storage).tickets).toEqual([
      { ...ticket, schemaVersion: 2, savedAt: null, logIndex: null },
    ]);
  });

  it('reports malformed records instead of treating them as tickets', () => {
    const storage = new MemoryStorage();
    const key = `megaplanets:purchased-ticket:${account}:broken`;
    storage.setItem(key, '{not-json');
    expect(readPersistedPurchasedTickets(account, storage)).toEqual({
      tickets: [],
      invalidKeys: [key],
    });
  });
});
