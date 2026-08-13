import type { PurchasedTicket } from './purchaseReceipt';

/**
 * Preserves receipt-verified/server-proof provenance, while letting indexed rows
 * fill in ticket IDs that are not present in the canonical set.
 */
export function mergePlanetTickets(
  localTickets: readonly PurchasedTicket[],
  onChainTickets: readonly PurchasedTicket[],
): readonly PurchasedTicket[] {
  const byId = new Map<string, PurchasedTicket>();
  for (const ticket of localTickets) byId.set(ticket.ticketId.toString(), ticket);
  for (const ticket of onChainTickets) {
    const key = ticket.ticketId.toString();
    if (!byId.has(key)) byId.set(key, ticket);
  }
  return [...byId.values()].sort((left, right) => {
    if (left.drawingId !== right.drawingId) return left.drawingId > right.drawingId ? -1 : 1;
    return left.ticketId > right.ticketId ? -1 : left.ticketId < right.ticketId ? 1 : 0;
  });
}
