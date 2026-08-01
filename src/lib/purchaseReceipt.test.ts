import { encodeAbiParameters, encodeEventTopics, zeroHash } from 'viem';
import { describe, expect, it } from 'vitest';
import { JACKPOT_ADDRESS, TICKET_SOURCE } from '@/config/contracts';
import { jackpotPurchaseAbi, readPurchasedTicket } from './purchaseReceipt';

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
