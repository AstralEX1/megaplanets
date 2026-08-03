/**
 * ---
 * @skill      https://llms.megapot.io/data-api
 * @customize  Lists the wallet's tickets for the current drawing — read via
 *             `GET /v1/wallets/{addr}/tickets/rounds/{roundId}`. The Data
 *             API is the default for this read on either side of
 *             settlement; for the active round, match-side fields
 *             (matched_normals, bonusball_match, winnings_amount) are
 *             null by design — the round hasn't been drawn yet.
 *
 *             For sub-block "I just bought, where's my ticket?" feedback
 *             a fork can swap to RPC `getUserTickets` + a
 *             `TicketPurchased` event subscription. The demo accepts the
 *             API's small indexer lag and surfaces an error message
 *             rather than vanishing the section if the fetch fails.
 * ---
 */
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import type { NavKey } from '@/components/layout/Nav';
import { useUserTickets } from '@/hooks/useUserTickets';
import { formatApiError } from '@/lib/api';
import {
  type PersistedPurchasedTicket,
  PURCHASED_TICKETS_UPDATED_EVENT,
  readPersistedPurchasedTickets,
} from '@/lib/purchaseReceipt';
import { TicketCard } from './TicketCard';

export function CurrentDrawingTickets({
  drawingId,
  onNavigate,
}: {
  drawingId: bigint | undefined;
  onNavigate?: (k: NavKey) => void;
}) {
  const { address } = useAccount();
  const { tickets, isLoading, error } = useUserTickets(address, drawingId);
  const [localTickets, setLocalTickets] = useState<readonly PersistedPurchasedTicket[]>([]);

  useEffect(() => {
    if (!address || drawingId === undefined) {
      setLocalTickets([]);
      return;
    }
    const sync = () => {
      const stored = readPersistedPurchasedTickets(address).tickets.filter(
        (ticket) => ticket.drawingId === drawingId,
      );
      setLocalTickets(stored);
    };
    sync();
    window.addEventListener(PURCHASED_TICKETS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PURCHASED_TICKETS_UPDATED_EVENT, sync);
  }, [address, drawingId]);

  if (!address) return null;

  const localIds = new Set(localTickets.map((ticket) => ticket.ticketId.toString()));
  const apiTickets = tickets.filter((ticket) => !localIds.has(ticket.user_ticket_id));
  const hasTickets = localTickets.length > 0 || apiTickets.length > 0;

  return (
    <section className="card-pad space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Current drawing</h2>
        {drawingId !== undefined && (
          <span className="font-mono text-xs text-zinc-500">#{drawingId.toString()}</span>
        )}
      </div>
      {error && localTickets.length === 0 ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Couldn't load tickets — {formatApiError(error)}
        </p>
      ) : isLoading && localTickets.length === 0 ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : !hasTickets ? (
        <p className="text-sm text-zinc-500">
          No tickets for this drawing yet.
          {onNavigate && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => onNavigate('play')}
                className="font-medium text-brand-primary-700 underline underline-offset-2 hover:text-brand-primary-800 dark:text-brand-primary-400 dark:hover:text-brand-primary-300"
              >
                Head to Play →
              </button>
            </>
          )}
        </p>
      ) : (
        <div className="space-y-1.5">
          {localTickets.map((ticket) => (
            <TicketCard
              key={`local-${ticket.ticketId.toString()}`}
              ticketId={ticket.ticketId}
              normals={ticket.normals}
              bonusball={ticket.bonusBall}
            />
          ))}
          {apiTickets.map((t) => (
            <TicketCard
              key={t.id}
              ticketId={BigInt(t.user_ticket_id)}
              normals={t.normals}
              bonusball={t.bonusball}
            />
          ))}
          {Boolean(error) && (
            <p className="pt-1 text-xs text-amber-600 dark:text-amber-300">
              Showing confirmed local tickets while the Megapot indexer catches up.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
