import type { Ticket } from './api';

export const DEFAULT_TICKET_HISTORY_ROUNDS = 10;

/** Returns the visible prefix while preserving older rows in the query cache. */
export function visibleTicketHistoryRounds<T>(
  rows: readonly T[],
  visibleRoundCount = DEFAULT_TICKET_HISTORY_ROUNDS,
): readonly T[] {
  return rows.slice(0, Math.max(0, visibleRoundCount));
}

/** Local receipt rows are optimistic and take precedence over stale API rows. */
export function mergeOptimisticTicketRows(
  localRows: readonly Ticket[],
  apiRows: readonly Ticket[],
): readonly Ticket[] {
  const byTicketId = new Map<string, Ticket>();
  for (const row of localRows) byTicketId.set(row.user_ticket_id, row);
  for (const row of apiRows) {
    if (!byTicketId.has(row.user_ticket_id)) byTicketId.set(row.user_ticket_id, row);
  }
  return [...byTicketId.values()];
}

/** A page failure is partial when already loaded rows remain renderable. */
export function hasPartialTicketHistory(error: unknown, loadedRoundCount: number): boolean {
  return error !== null && error !== undefined && loadedRoundCount > 0;
}
