import { describe, expect, it } from 'vitest';
import type { PurchasedTicket } from './purchaseReceipt';
import { selectRevealTickets } from './revealPlan';

const ticket = (ticketId: bigint, originTxHash: string): PurchasedTicket => ({
  ticketId,
  drawingId: 218n,
  normals: [1, 2, 3, 4, 5],
  bonusBall: 1,
  originTxHash: originTxHash as `0x${string}`,
  logIndex: ticketId,
});

describe('selectRevealTickets', () => {
  it('uses only exact bulk execution tickets when same-drawing recovery has older tickets', () => {
    const oldRecovered = [ticket(12n, `0x${'1'.repeat(64)}`), ticket(13n, `0x${'2'.repeat(64)}`)];
    const exactExecution = [
      ticket(90n, `0x${'9'.repeat(64)}`),
      ticket(91n, `0x${'a'.repeat(64)}`),
      ticket(90n, `0x${'9'.repeat(64)}`),
    ];

    expect(
      selectRevealTickets({
        exactTickets: exactExecution,
        recoveredTickets: oldRecovered,
        mode: 'bulk',
        drawingId: 218n,
        expectedCount: 50,
      }).map((candidate) => candidate.ticketId),
    ).toEqual([90n, 91n]);
  });

  it('does not let a different wallet or network reuse an exact ticket ID', () => {
    const exact = [ticket(90n, `0x${'9'.repeat(64)}`)];

    expect(
      selectRevealTickets({
        exactTickets: [],
        recoveredTickets: exact,
        mode: 'direct',
        drawingId: 218n,
        purchaseTxHash: `0x${'b'.repeat(64)}`,
        expectedCount: 1,
      }),
    ).toEqual([]);
    expect(
      selectRevealTickets({
        exactTickets: [],
        recoveredTickets: exact,
        mode: 'direct',
        drawingId: 1n,
        purchaseTxHash: `0x${'9'.repeat(64)}`,
        expectedCount: 1,
      }),
    ).toEqual([]);
  });
});
