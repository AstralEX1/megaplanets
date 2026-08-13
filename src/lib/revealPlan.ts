import type { PurchasedTicket } from './purchaseReceipt';

export type RevealPurchaseMode = 'direct' | 'bulk';

export type RevealPlanOptions = {
  /** Receipt-verified tickets from the purchase currently being revealed. */
  exactTickets: readonly PurchasedTicket[];
  /** Proof/RPC/Data API recovery candidates used only when exact refs are absent. */
  recoveredTickets: readonly PurchasedTicket[];
  mode: RevealPurchaseMode;
  drawingId?: bigint;
  purchaseTxHash?: string | null;
  expectedCount: number;
  indexedTicketIds?: ReadonlySet<string>;
};

function stableDedupe(tickets: readonly PurchasedTicket[]): readonly PurchasedTicket[] {
  const seen = new Set<string>();
  const result: PurchasedTicket[] = [];
  for (const ticket of tickets) {
    const key = ticket.ticketId.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ticket);
  }
  return result;
}

function compareFallbackTickets(left: PurchasedTicket, right: PurchasedTicket) {
  if (left.drawingId !== right.drawingId) return left.drawingId > right.drawingId ? -1 : 1;
  if (left.ticketId !== right.ticketId) return left.ticketId > right.ticketId ? -1 : 1;
  const leftHash = left.originTxHash.toLowerCase();
  const rightHash = right.originTxHash.toLowerCase();
  if (leftHash !== rightHash) return leftHash < rightHash ? -1 : 1;
  if (left.logIndex !== right.logIndex) return left.logIndex < right.logIndex ? -1 : 1;
  return 0;
}

/**
 * Selects the tickets for one reveal flow.
 *
 * Exact receipt/event references always win. Recovery is deliberately a fallback:
 * it is filtered to the active drawing (and direct purchase hash where available),
 * deduped, sorted deterministically, and bounded to the requested quantity.
 */
export function selectRevealTickets({
  exactTickets,
  recoveredTickets,
  mode,
  drawingId,
  purchaseTxHash,
  expectedCount,
  indexedTicketIds,
}: RevealPlanOptions): readonly PurchasedTicket[] {
  const exactForFlow = exactTickets.filter(
    (ticket) =>
      (drawingId === undefined || ticket.drawingId === drawingId) &&
      (mode !== 'direct' ||
        !purchaseTxHash ||
        ticket.originTxHash.toLowerCase() === purchaseTxHash.toLowerCase()),
  );
  if (exactForFlow.length > 0) return stableDedupe(exactForFlow);

  // A fresh direct purchase has no canonical transaction reference until its
  // receipt is decoded. Never substitute an older same-drawing ticket while it
  // is still waiting for that exact receipt.
  if (mode === 'direct' && !purchaseTxHash) return [];

  const fallback = recoveredTickets
    .filter(
      (ticket) =>
        (drawingId === undefined || ticket.drawingId === drawingId) &&
        (mode !== 'direct' ||
          !purchaseTxHash ||
          ticket.originTxHash.toLowerCase() === purchaseTxHash.toLowerCase()) &&
        !indexedTicketIds?.has(ticket.ticketId.toString()),
    )
    .sort(compareFallbackTickets);
  const deduped = stableDedupe(fallback);
  return expectedCount > 0 ? deduped.slice(0, expectedCount) : [];
}
