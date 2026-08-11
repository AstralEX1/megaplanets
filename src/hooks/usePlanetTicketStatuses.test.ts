import { describe, expect, it } from 'vitest';
import type { Ticket } from '@/lib/api';
import { derivePlanetTicketStatus } from './usePlanetTicketStatuses';

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'api-ticket-24',
  wallet: '0x0000000000000000000000000000000000000001',
  buyer: '0x0000000000000000000000000000000000000001',
  round_id: '218',
  user_ticket_id: '24',
  normals: [4, 11, 17, 26, 39],
  bonusball: 66,
  matched_normals: null,
  bonusball_match: null,
  winnings_amount: null,
  claimed: false,
  claimed_tx_hash: null,
  tx_hash: '0x1234',
  block_number: 1,
  created_at: '2026-08-11T00:00:00.000Z',
  ...overrides,
});

describe('derivePlanetTicketStatus', () => {
  it('formats an open current drawing as a bare countdown value', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      currentDrawingId: 218n,
      phase: 'open',
      drawingTime: 10_000n,
      nowMs: 6_277_000,
      drawingStatus: 'active',
    })).toEqual({ kind: 'countdown', time: '01:02:03' });
  });

  it('shows Drawing after sales lock and while settlement is pending', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      currentDrawingId: 218n,
      phase: 'settling',
      nowMs: 0,
      drawingStatus: 'active',
    })).toEqual({ kind: 'drawing' });
  });

  it('shows Claim with the real ticket amount for an unclaimed win', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      nowMs: 0,
      drawingStatus: 'settled',
      apiTicket: ticket({
        matched_normals: 4,
        bonusball_match: true,
        winnings_amount: { amount: '12500000', decimals: 6 },
      }),
    })).toEqual({ kind: 'claim', amount: 12_500_000n, ticketId: 24n });
  });

  it('preserves the amount after a winning ticket is claimed', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      nowMs: 0,
      drawingStatus: 'settled',
      apiTicket: ticket({
        matched_normals: 4,
        bonusball_match: true,
        winnings_amount: { amount: '12500000', decimals: 6 },
        claimed: true,
      }),
    })).toEqual({ kind: 'claimed', amount: 12_500_000n });
  });

  it('marks a settled non-winning ticket as Drawn', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      nowMs: 0,
      drawingStatus: 'settled',
      apiTicket: ticket({ matched_normals: 1, bonusball_match: false }),
    })).toEqual({ kind: 'drawn' });
  });

  it('uses an on-chain zero payout to mark a settled ticket as Drawn', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      nowMs: 0,
      drawingStatus: 'settled',
      onChainOutcome: { tierId: 2, amount: 0n },
    })).toEqual({ kind: 'drawn' });
  });

  it('uses an on-chain payout when the testnet Data API has no ticket row', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      nowMs: 0,
      drawingStatus: 'settled',
      onChainOutcome: { tierId: 9, amount: 12_500_000n },
    })).toEqual({ kind: 'claim', amount: 12_500_000n, ticketId: 24n });
  });

  it('keeps a genuinely unreadable settled ticket unavailable', () => {
    expect(derivePlanetTicketStatus({
      ticketId: '24',
      drawingId: '218',
      nowMs: 0,
      drawingStatus: 'settled',
    })).toEqual({ kind: 'unavailable' });
  });
});
