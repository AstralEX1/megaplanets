import type { QueryClient } from '@tanstack/react-query';
import { API_BASE_URL, QK } from './api';
import { BACKEND_API_BASE_URL } from './backendApi';

/**
 * Invalidates browser reads that can change after a confirmed wallet write.
 *
 * Keep this list centralized: direct purchases, keeper executions, Planet
 * mints, and claims all affect overlapping ticket/ownership surfaces.
 */
export async function invalidatePostWriteQueries(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
): Promise<void> {
  const queryKeys = [
    [QK.NS, API_BASE_URL, QK.walletTicketsByRound],
    [QK.NS, API_BASE_URL, QK.walletTickets],
    [QK.NS, API_BASE_URL, QK.walletStats],
    [QK.NS, API_BASE_URL, QK.walletWins],
    [QK.NS, 'eligible-planet-tickets'],
    [QK.NS, 'direct-planet-holdings'],
    [QK.NS, BACKEND_API_BASE_URL, 'indexed-planets'],
    ['megaplanets-backend', BACKEND_API_BASE_URL, 'wallet-mining'],
  ] as const;

  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
  );
}
