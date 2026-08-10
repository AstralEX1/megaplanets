import type { PurchasedTicket } from './purchaseReceipt';

/** Prefers read-only on-chain provenance, while preserving local confirmations if RPC is unavailable. */
export function mergePlanetTickets(
  localTickets: readonly PurchasedTicket[],
  onChainTickets: readonly PurchasedTicket[],
): readonly PurchasedTicket[] {
  const byId = new Map<string, PurchasedTicket>();
  for (const ticket of localTickets) byId.set(ticket.ticketId.toString(), ticket);
  for (const ticket of onChainTickets) byId.set(ticket.ticketId.toString(), ticket);
  return [...byId.values()].sort((left, right) => {
    if (left.drawingId !== right.drawingId) return left.drawingId > right.drawingId ? -1 : 1;
    return left.ticketId > right.ticketId ? -1 : left.ticketId < right.ticketId ? 1 : 0;
  });
}
