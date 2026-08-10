import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { API_BASE_URL, api, apiQueryRetry, QK, type RoundStatus } from '@/lib/api';

const THIRTY_SECONDS = 30_000;

export function drawingStatusLabel(status: RoundStatus | undefined) {
  if (status === 'active') return 'DRAWING ACTIVE';
  if (status === 'settled') return 'DRAWING SETTLED';
  return 'DRAWING STATUS UNAVAILABLE';
}

/** Reads only the historical API status for ticket-linked drawings; ticket proof stays on-chain. */
export function usePlanetDrawingStates(drawingIds: readonly bigint[]) {
  const uniqueDrawingIds = useMemo(
    () => [...new Set(drawingIds.map((drawingId) => drawingId.toString()))],
    [drawingIds],
  );
  const queries = useQueries({
    queries: uniqueDrawingIds.map((drawingId) => ({
      queryKey: [QK.NS, API_BASE_URL, QK.round, drawingId],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.round(drawingId, { signal }),
      staleTime: THIRTY_SECONDS,
      ...apiQueryRetry,
    })),
  });
  const states = useMemo(
    () => new Map(queries.flatMap((query) => query.data ? [[query.data.id, query.data.status] as const] : [])),
    [queries],
  );

  return {
    states,
    isLoading: queries.some((query) => query.isLoading),
    error: queries.find((query) => query.error)?.error,
  };
}
