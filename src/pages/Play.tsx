import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { ApprovalButton } from '@/components/common/ApprovalButton';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { UsdcAmount } from '@/components/common/UsdcAmount';
import { Ball } from '@/components/lottery/Ball';
import { TicketPicker } from '@/components/lottery/TicketPicker';
import { JACKPOT_ADDRESS } from '@/config/contracts';
import { COPY } from '@/config/copy';
import { useBuyTickets } from '@/hooks/useBuyTickets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { type CustomTicket, isValidTicket, randomTicket } from '@/lib/tickets';

const EMPTY_TICKET: CustomTicket = { normals: [], bonusball: 0 };

/** MegaPlanets MVP ticket checkout: precisely one custom or quick-pick ticket. */
export function Play() {
  const { isConnected } = useAccount();
  const { state, drawingId, phase } = useJackpotState();
  const [ticket, setTicket] = useState<CustomTicket | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const buy = useBuyTickets(ticket);

  const bounds = useMemo(
    () => (state ? { ballMax: state.ballMax, bonusballMax: state.bonusballMax } : null),
    [state],
  );
  const validTicket = ticket !== null && bounds !== null && isValidTicket(ticket, bounds);
  const buyDisabled =
    !isConnected || !validTicket || phase !== 'open' || buy.isPending || !buy.isReady;

  useEffect(() => {
    if (buy.isSuccess) setPickerOpen(false);
  }, [buy.isSuccess]);

  const quickPick = () => {
    if (!bounds) return;
    setTicket(randomTicket(bounds));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!isConnected && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {COPY.connectToBuy}
        </div>
      )}

      {phase !== 'open' && (
        <div className="rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {COPY.ticketsPaused}. Wait for the next drawing to open.
        </div>
      )}

      <section className="card-pad space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-600 dark:text-brand-primary-400">
            MegaPlanets entry
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Choose one ticket</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Each confirmed Megapot ticket will unlock one deterministic Planet mint.
          </p>
        </header>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Your numbers
            </span>
            {drawingId !== undefined && (
              <span className="text-xs tabular-nums text-zinc-500">
                Drawing #{drawingId.toString()}
              </span>
            )}
          </div>
          {ticket ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {ticket.normals.map((number) => (
                <Ball key={number} n={number} selected />
              ))}
              <span className="px-1 text-zinc-400">+</span>
              <Ball n={ticket.bonusball} variant="bonus" selected />
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No numbers selected yet.</p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() => setPickerOpen(true)}
              disabled={!bounds || buy.isPending}
            >
              Pick numbers manually
            </Button>
            <Button variant="secondary" onClick={quickPick} disabled={!bounds || buy.isPending}>
              Quick pick
            </Button>
          </div>
          {bounds && (
            <p className="mt-3 text-xs text-zinc-500">
              Normal balls 1–{bounds.ballMax} · Bonus ball 1–{bounds.bonusballMax}
            </p>
          )}
        </div>

        <div className="flex items-baseline justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">One Megapot ticket</span>
          <span className="text-lg font-semibold tabular-nums">
            {state ? <UsdcAmount value={state.ticketPrice} precision={2} /> : 'Loading price…'}
          </span>
        </div>

        <ApprovalButton spender={JACKPOT_ADDRESS} amount={state?.ticketPrice ?? 0n}>
          <Button
            variant="primary"
            size="md"
            onClick={buy.buy}
            disabled={buyDisabled}
            className="w-full"
          >
            {buy.isWaitingSignature
              ? 'Sign in your wallet…'
              : buy.isMining
                ? 'Confirming on-chain…'
                : !ticket
                  ? 'Choose your ticket'
                  : !buy.isReady
                    ? 'Validating ticket…'
                    : 'Buy 1 Megapot ticket'}
          </Button>
        </ApprovalButton>

        <TxStatus
          hash={buy.txHash}
          isPending={buy.isPending}
          isSuccess={buy.isSuccess}
          error={buy.error}
        />

        {buy.purchasedTicket && (
          <div className="rounded-lg border border-brand-primary-300 bg-brand-primary-50 px-4 py-3 text-sm text-brand-primary-900 dark:border-brand-primary-900 dark:bg-brand-primary-950 dark:text-brand-primary-100">
            <p className="font-semibold">
              Ticket #{buy.purchasedTicket.ticketId.toString()} confirmed
            </p>
            <p className="mt-1 text-xs">
              Saved locally for this wallet. Its deterministic preview is available on the Planets
              tab.
            </p>
          </div>
        )}
      </section>

      {bounds && (
        <TicketPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSave={setTicket}
          ticket={ticket ?? EMPTY_TICKET}
          bounds={bounds}
        />
      )}
    </div>
  );
}
