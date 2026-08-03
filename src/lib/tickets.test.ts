import { describe, expect, it } from 'vitest';
import {
  buildDirectTickets,
  getBulkOrderShape,
  isValidTicket,
  pickPurchaseRoute,
  randomTicket,
  totalCost,
} from './tickets';

describe('purchase routing', () => {
  it('routes one to ten tickets to immediate Jackpot checkout and 11+ to bulk', () => {
    expect(pickPurchaseRoute({ count: 1, recurring: false })).toBe('jackpot');
    expect(pickPurchaseRoute({ count: 10, recurring: false })).toBe('jackpot');
    expect(pickPurchaseRoute({ count: 11, recurring: false })).toBe('bulk');
  });

  it('computes the bulk static/dynamic split with a ten-static-ticket cap', () => {
    expect(getBulkOrderShape({ count: 11, staticTicketCount: 10 })).toEqual({
      dynamicCount: 1,
      staticTicketCount: 10,
    });
    expect(getBulkOrderShape({ count: 50, staticTicketCount: 0 })).toEqual({
      dynamicCount: 50,
      staticTicketCount: 0,
    });
    expect(() => getBulkOrderShape({ count: 10, staticTicketCount: 1 })).toThrow(/bulk/i);
    expect(() => getBulkOrderShape({ count: 11, staticTicketCount: 11 })).toThrow(/static/i);
  });

  it('keeps total purchase cost as raw USDC bigint', () => {
    expect(totalCost({ ticketPriceUsdcRaw: 1_000_000n, count: 11 })).toBe(11_000_000n);
  });

  it('generates complete client-side direct quick-picks', () => {
    const ticket = randomTicket({ ballMax: 30, bonusballMax: 12 });
    expect(isValidTicket(ticket, { ballMax: 30, bonusballMax: 12 })).toBe(true);
  });

  it('fills only the unconfigured direct tickets with client-side quick-picks', () => {
    const configured = { normals: [1, 2, 3, 4, 5], bonusball: 6 };
    const generated = { normals: [6, 7, 8, 9, 10], bonusball: 11 };
    expect(
      buildDirectTickets({
        customTickets: [configured],
        count: 2,
        bounds: { ballMax: 30, bonusballMax: 12 },
        random: () => generated,
      }),
    ).toEqual([configured, generated]);
  });

  it('rejects incomplete direct purchase input before simulating the write', () => {
    expect(() =>
      buildDirectTickets({
        customTickets: [{ normals: [1, 2], bonusball: 3 }],
        count: 1,
        bounds: { ballMax: 30, bonusballMax: 12 },
      }),
    ).toThrow(/custom ticket/i);
  });
});
