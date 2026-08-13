import { describe, expect, it } from 'vitest';
import type { Ticket } from './api';
import {
  hasPartialTicketHistory,
  mergeOptimisticTicketRows,
  visibleTicketHistoryRounds,
} from './ticketHistory';

const ticket = (id: string, roundId: string): Ticket => ({
  id,
  wallet: '0x0000000000000000000000000000000000000001',
  buyer: '0x0000000000000000000000000000000000000001',
  round_id: roundId,
  user_ticket_id: id,
  normals: [1, 2, 3, 4, 5],
  bonusball: 1,
  matched_normals: null,
  bonusball_match: null,
  winnings_amount: null,
  claimed: false,
  claimed_tx_hash: null,
  tx_hash: `0x${id.padStart(64, '0')}` as `0x${string}`,
  block_number: 1,
  created_at: '2026-08-12T00:00:00.000Z',
});

describe('ticket history presentation', () => {
  it('shows only the latest ten rounds until the user explicitly loads older rounds', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      roundId: String(220 - index),
      tickets: [ticket(String(index + 1), String(220 - index))],
    }));

    expect(visibleTicketHistoryRounds(rows, 10).map((row) => row.roundId)).toEqual(
      rows.slice(0, 10).map((row) => row.roundId),
    );
  });

  it('lets optimistic receipt rows win over stale API rows with the same ticket id', () => {
    const local = ticket('7', '218');
    const staleApi = { ...local, normals: [6, 7, 8, 9, 10] };
    const apiOnly = ticket('8', '218');

    expect(mergeOptimisticTicketRows([local], [staleApi, apiOnly])).toEqual([local, apiOnly]);
  });

  it('keeps already loaded rows visible when a later Data API page fails', () => {
    expect(hasPartialTicketHistory(new Error('upstream unavailable'), 3)).toBe(true);
    expect(hasPartialTicketHistory(new Error('upstream unavailable'), 0)).toBe(false);
    expect(hasPartialTicketHistory(null, 3)).toBe(false);
  });
});
