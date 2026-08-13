/**
 * ---
 * @skill      https://llms.megapot.io/data-api
 * @endpoint   GET /v1/wallets/{address}/tickets
 * @customize  Cross-drawing wallet tickets, cursor-paginated via TanStack
 *             Query's `useInfiniteQuery`. Mirrors `useWalletWins`'s shape,
 *             but groups by `round_id` so a "past round tickets" surface
 *             can render one card per round the user played in.
 *
 *             Sort: rounds are sorted newest-first by bigint comparator
 *             (round IDs can exceed Number.MAX_SAFE_INTEGER in theory,
 *             so a Number-based sort is unsafe). Tickets within each
 *             round keep API order.
 *
 *             `excludeRoundId` is a render-time filter — the current
 *             drawing is already covered by `<CurrentDrawingTickets>`,
 *             so the Tickets page filters it out here. The option is
 *             NOT included in the queryKey: filtering is a UI concern,
 *             not a cache-bust concern, and including it would create
 *             a separate cache entry for every drawingId transition.
 *
 *             Retry: API errors with `code` of `rate_limited` /
 *             `upstream_unavailable` retry up to 3 times with `Retry-After`
 *             honored — see `apiQueryRetry`.
 * ---
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL, api, apiQueryRetry, QK, type Ticket } from '@/lib/api';
import {
  DEFAULT_TICKET_HISTORY_ROUNDS,
  visibleTicketHistoryRounds,
} from '@/lib/ticketHistory';

const ONE_MINUTE = 60 * 1000;

export type WalletTicketsByRound = {
  /** Stringified round id so React keys / map lookups stay primitive. */
  roundId: string;
  tickets: Ticket[];
  ticketCount: number;
  /** Tickets in this round whose `winnings_amount > 0`. */
  winsCount: number;
  /** Sum of `winnings_amount` for the round's tickets, in raw USDC bigint. */
  totalWinnings: bigint;
};

export function shouldLoadOlderTicketRounds(
  loadedRoundCount: number,
  visibleRoundCount: number,
  hasNextPage: boolean,
): boolean {
  return loadedRoundCount > visibleRoundCount || hasNextPage;
}

export function useWalletTickets(
  address: `0x${string}` | undefined,
  opts: {
    pageSize?: number;
    excludeRoundId?: string;
    initialRoundCount?: number;
  } = {},
) {
  const pageSize = opts.pageSize ?? 50;
  const excludeRoundId = opts.excludeRoundId;
  const initialRoundCount = opts.initialRoundCount ?? DEFAULT_TICKET_HISTORY_ROUNDS;
  const resetKey = `${address ?? ''}:${pageSize}`;
  const [visibleRoundCount, setVisibleRoundCount] = useState(initialRoundCount);
  const query = useInfiniteQuery({
    queryKey: [QK.NS, API_BASE_URL, QK.walletTickets, address, pageSize],
    queryFn: ({ pageParam, signal }) =>
      // biome-ignore lint/style/noNonNullAssertion: guarded by `enabled: !!address` below
      api.walletTickets(address!, {
        limit: pageSize,
        cursor: pageParam,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.has_more ? (last.next_cursor ?? undefined) : undefined),
    enabled: !!address,
    staleTime: ONE_MINUTE,
    ...apiQueryRetry,
  });

  /** Flat ticket list across every fetched page. */
  const tickets: Ticket[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  const groupedByRound: WalletTicketsByRound[] = useMemo(() => {
    const byRound = new Map<string, Ticket[]>();
    for (const t of tickets) {
      if (excludeRoundId && t.round_id === excludeRoundId) continue;
      const list = byRound.get(t.round_id) ?? [];
      list.push(t);
      byRound.set(t.round_id, list);
    }
    return Array.from(byRound.entries())
      .sort(([a], [b]) => {
        const ai = BigInt(a);
        const bi = BigInt(b);
        return ai > bi ? -1 : ai < bi ? 1 : 0;
      })
      .map(([roundId, ts]) => {
        let winsCount = 0;
        let totalWinnings = 0n;
        for (const t of ts) {
          if (t.winnings_amount) {
            const amt = BigInt(t.winnings_amount.amount);
            if (amt > 0n) {
              winsCount++;
              totalWinnings += amt;
            }
          }
        }
        return {
          roundId,
          tickets: ts,
          ticketCount: ts.length,
          winsCount,
          totalWinnings,
        };
      });
  }, [tickets, excludeRoundId]);

  // Reset the visible prefix when the wallet or page-size cache changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey captures the query identity used for this local UI state.
  useEffect(() => {
    setVisibleRoundCount(initialRoundCount);
  }, [initialRoundCount, resetKey]);

  const hasOlderRounds = shouldLoadOlderTicketRounds(
    groupedByRound.length,
    visibleRoundCount,
    query.hasNextPage,
  ) || (query.error !== null && groupedByRound.length > 0);
  const loadOlderRounds = async () => {
    if (groupedByRound.length > visibleRoundCount) {
      setVisibleRoundCount((current) => current + initialRoundCount);
      return;
    }
    await query.fetchNextPage();
  };

  return {
    tickets,
    groupedByRound,
    visibleGroupedByRound: visibleTicketHistoryRounds(groupedByRound, visibleRoundCount),
    fetchNextPage: loadOlderRounds,
    hasNextPage: hasOlderRounds,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
