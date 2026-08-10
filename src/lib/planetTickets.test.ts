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
  it('uses canonical on-chain provenance for duplicates and sorts newest drawings first', () => {
    const local = ticket(1n, 5n, `0x${'aa'.repeat(32)}`);
    const canonical = ticket(1n, 5n, `0x${'bb'.repeat(32)}`);
    const newer = ticket(2n, 6n, `0x${'cc'.repeat(32)}`);

    expect(mergePlanetTickets([local], [canonical, newer])).toEqual([newer, canonical]);
  });
});
