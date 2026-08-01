import { encodeAbiParameters, encodeEventTopics, zeroHash } from 'viem';
import { describe, expect, it } from 'vitest';
import { JACKPOT_ADDRESS, TICKET_SOURCE } from '@/config/contracts';
import {
  jackpotPurchaseAbi,
  persistPurchasedTicket,
  readPersistedPurchasedTickets,
  readPurchasedTicket,
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

describe('readPurchasedTicket', () => {
  it('extracts the MegaPlanets ticket id from TicketPurchased', () => {
    const topics = encodeEventTopics({
      abi: jackpotPurchaseAbi,
      eventName: 'TicketPurchased',
      args: {
        recipient: '0x1111111111111111111111111111111111111111',
        currentDrawingId: 123n,
        source: TICKET_SOURCE,
      },
    });
    const data = encodeAbiParameters(
      [
        { type: 'uint256', name: 'userTicketId' },
        { type: 'uint8[]', name: 'normals' },
        { type: 'uint8', name: 'bonusball' },
        { type: 'bytes32', name: 'referralScheme' },
      ],
      [456n, [2, 7, 14, 22, 29], 9, zeroHash],
    );

    const ticket = readPurchasedTicket({
      logs: [{ address: JACKPOT_ADDRESS, topics, data }],
    } as never);

    expect(ticket).toEqual({
      ticketId: 456n,
      drawingId: 123n,
      normals: [2, 7, 14, 22, 29],
      bonusBall: 9,
    });
  });

  it('rejects a purchase event with another source tag', () => {
    const ticket = readPurchasedTicket({ logs: [] } as never);
    expect(ticket).toBeNull();
  });
});

describe('confirmed ticket persistence', () => {
  const account = '0x1111111111111111111111111111111111111111' as const;
  const otherAccount = '0x2222222222222222222222222222222222222222' as const;
  const ticket = { ticketId: 456n, drawingId: 123n, normals: [2, 7, 14, 22, 29], bonusBall: 9 };

  it('writes the versioned record and isolates wallets', () => {
    const storage = new MemoryStorage();
    persistPurchasedTicket(account, ticket, { storage, savedAt: '2026-08-01T12:00:00.000Z' });
    persistPurchasedTicket(otherAccount, { ...ticket, ticketId: 999n }, { storage });

    expect(readPersistedPurchasedTickets(account, storage)).toEqual({
      tickets: [{ ...ticket, schemaVersion: 1, savedAt: '2026-08-01T12:00:00.000Z' }],
      invalidKeys: [],
    });
  });

  it('reads legacy Stage 2 records and sorts newest first', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      `megaplanets:purchased-ticket:${account}:456`,
      JSON.stringify({
        ticketId: '456',
        drawingId: '123',
        normals: [29, 2, 22, 7, 14],
        bonusBall: 9,
      }),
    );
    persistPurchasedTicket(
      account,
      { ...ticket, ticketId: 500n },
      {
        storage,
        savedAt: '2026-08-01T13:00:00.000Z',
      },
    );
    expect(
      readPersistedPurchasedTickets(account, storage).tickets.map((item) => item.ticketId),
    ).toEqual([500n, 456n]);
    expect(readPersistedPurchasedTickets(account, storage).tickets[1]?.schemaVersion).toBe(0);
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
