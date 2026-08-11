import { describe, expect, it, vi } from 'vitest';
import type { Ticket } from '@/lib/api';
import type { PurchasedTicket } from '@/lib/purchaseReceipt';
import {
  readEligibleTicketsFromWalletHistory,
  readRecentEligibleTicketsFromChain,
} from './useEligiblePlanetTickets';

const ACCOUNT = '0x0000000000000000000000000000000000000001' as const;
const HASH_A = `0x${'a'.repeat(64)}` as const;
const HASH_B = `0x${'b'.repeat(64)}` as const;

function historyTicket(ticketId: string, transactionHash: `0x${string}`): Ticket {
  return {
    id: ticketId,
    wallet: ACCOUNT,
    buyer: ACCOUNT,
    round_id: '218',
    user_ticket_id: ticketId,
    normals: [4, 11, 17, 26, 39],
    bonusball: 66,
    matched_normals: null,
    bonusball_match: null,
    winnings_amount: null,
    claimed: false,
    claimed_tx_hash: null,
    tx_hash: transactionHash,
    block_number: 45_000_000,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

function confirmedTicket(ticketId: bigint, transactionHash: `0x${string}`, logIndex = 4n): PurchasedTicket {
  return {
    ticketId,
    drawingId: 218n,
    normals: [4, 11, 17, 26, 39],
    bonusBall: 66,
    originTxHash: transactionHash,
    logIndex,
  };
}

describe('readEligibleTicketsFromWalletHistory', () => {
  it('discovers paginated wallet history through receipts without running a chain-wide log scan', async () => {
    const getTransactionReceipt = vi
      .fn()
      .mockResolvedValueOnce({ transactionHash: HASH_A })
      .mockResolvedValueOnce({ transactionHash: HASH_B });
    const getLogs = vi.fn();
    const listWalletTickets = vi
      .fn()
      .mockResolvedValueOnce({ data: [historyTicket('7', HASH_A)], has_more: true, next_cursor: 'next' })
      .mockResolvedValueOnce({ data: [historyTicket('8', HASH_B)], has_more: false, next_cursor: null });
    const readReceiptTickets = vi
      .fn()
      .mockReturnValueOnce([confirmedTicket(7n, HASH_A), confirmedTicket(999n, HASH_A)])
      .mockReturnValueOnce([confirmedTicket(8n, HASH_B, 5n)]);

    const tickets = await readEligibleTicketsFromWalletHistory(
      { getTransactionReceipt, getLogs } as never,
      ACCOUNT,
      { listWalletTickets, readReceiptTickets },
    );

    expect(tickets.map((ticket) => ticket.ticketId)).toEqual([8n, 7n]);
    expect(listWalletTickets).toHaveBeenNthCalledWith(1, ACCOUNT, { limit: 100, cursor: undefined });
    expect(listWalletTickets).toHaveBeenNthCalledWith(2, ACCOUNT, { limit: 100, cursor: 'next' });
    expect(getTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(getLogs).not.toHaveBeenCalled();
  });

  it('recovers recent canonical purchases before the Data API indexes them', async () => {
    const getBlockNumber = vi.fn().mockResolvedValue(45_341_720n);
    const getLogs = vi.fn().mockResolvedValue([
      { transactionHash: HASH_A },
      { transactionHash: HASH_A },
      { transactionHash: HASH_B },
    ]);
    const getTransactionReceipt = vi
      .fn()
      .mockResolvedValueOnce({ transactionHash: HASH_A })
      .mockResolvedValueOnce({ transactionHash: HASH_B });
    const readReceiptTickets = vi
      .fn()
      .mockReturnValueOnce([confirmedTicket(70n, HASH_A), confirmedTicket(71n, HASH_A, 5n)])
      .mockReturnValueOnce([confirmedTicket(72n, HASH_B, 6n)]);

    const tickets = await readRecentEligibleTicketsFromChain(
      { getBlockNumber, getLogs, getTransactionReceipt } as never,
      ACCOUNT,
      { readReceiptTickets },
    );

    expect(tickets.map((ticket) => ticket.ticketId)).toEqual([72n, 71n, 70n]);
    expect(getTransactionReceipt).toHaveBeenCalledTimes(2);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 45_339_721n, toBlock: 45_341_720n }),
    );
  });
});
