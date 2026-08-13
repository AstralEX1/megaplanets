import { describe, expect, it } from 'vitest';
import { mergePlanetTickets } from './planetTickets';
import type { PurchasedTicket } from './purchaseReceipt';

function ticket(ticketId: bigint, drawingId: bigint, originTxHash: `0x${string}`): PurchasedTicket {
  return {
    ticketId,
    drawingId,
    normals: [2, 7, 14, 22, 29],
    bonusBall: 9,
    originTxHash,
    logIndex: 4n,
  };
}

describe('mergePlanetTickets', () => {
  it('preserves canonical provenance for duplicates and sorts newest drawings first', () => {
    const canonical = ticket(1n, 5n, `0x${'aa'.repeat(32)}`);
    const indexedFallback = ticket(1n, 5n, `0x${'bb'.repeat(32)}`);
    const newer = ticket(2n, 6n, `0x${'cc'.repeat(32)}`);

    expect(mergePlanetTickets([canonical], [indexedFallback, newer])).toEqual([newer, canonical]);
  });

  it('does not let an indexed duplicate replace canonical ticket provenance', () => {
    const canonical: PurchasedTicket = {
      ...ticket(849874n, 218n, `0x${'aa'.repeat(32)}`),
      normals: [1, 3, 8, 21, 34],
      bonusBall: 17,
      logIndex: 5n,
    };
    const indexedFallback: PurchasedTicket = {
      ...canonical,
      drawingId: 999n,
      normals: [2, 4, 6, 8, 10],
      bonusBall: 12,
      originTxHash: `0x${'bb'.repeat(32)}`,
      logIndex: 0n,
    };

    expect(mergePlanetTickets([canonical], [indexedFallback])).toEqual([canonical]);
  });
});
