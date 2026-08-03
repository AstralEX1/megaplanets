import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { ApprovalButton } from '@/components/common/ApprovalButton';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { UsdcAmount } from '@/components/common/UsdcAmount';
import { Ball } from '@/components/lottery/Ball';
import { BulkProgress } from '@/components/lottery/BulkProgress';
import { TicketBuilder } from '@/components/lottery/TicketBuilder';
import {
  BATCH_PURCHASE_FACILITATOR_ADDRESS,
  EXPLORER_TX_URL,
  JACKPOT_ADDRESS,
} from '@/config/contracts';
import { COPY } from '@/config/copy';
import { useBulkPurchase } from '@/hooks/useBulkPurchase';
import { useBuyTickets } from '@/hooks/useBuyTickets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { BULK_THRESHOLD, type CustomTicket, isValidTicket, totalCost } from '@/lib/tickets';

const QUANTITY_PRESETS = [10, 25, 50] as const;
const PREVIEW_NORMALS = [3, 14, 17, 21, 23] as const;

/** Megapot-inspired checkout for immediate 1–10 tickets and 11–50 keeper random orders. */
export function Play() {
  const { isConnected } = useAccount();
  const { state, drawingId, phase, refetch: refetchJackpot } = useJackpotState();
  const [count, setCount] = useState(1);
  const [staticTickets, setStaticTickets] = useState<readonly CustomTicket[]>([]);

  const bounds = useMemo(
    () => (state ? { ballMax: state.ballMax, bonusballMax: state.bonusballMax } : null),
    [state],
  );
  const isBulk = count > BULK_THRESHOLD;
  // Product decision: 11+ orders are always keeper-random. No user-selected
  // ticket data is passed to the facilitator.
  const dynamicCount = isBulk ? count : 0;
  const bulk = useBulkPurchase(isBulk ? { dynamicCount, staticTickets: [] } : null);
  const direct = useBuyTickets();
  const validStaticTickets =
    bounds !== null && staticTickets.every((ticket) => isValidTicket(ticket, bounds));
  const directReady = !isBulk && bounds !== null && validStaticTickets && direct.isReady;
  const meetsBulkMinimum =
    bulk.minimumTicketCount !== undefined && BigInt(count) >= bulk.minimumTicketCount;
  const bulkReady = isBulk && meetsBulkMinimum && !bulk.hasActiveOrder && bulk.create.isReady;
  const total = state ? totalCost({ ticketPriceUsdcRaw: state.ticketPrice, count }) : 0n;
  const purchase = isBulk ? bulk.create : direct;
  const approvalSpender = isBulk ? BATCH_PURCHASE_FACILITATOR_ADDRESS : JACKPOT_ADDRESS;
  const approvalAmount = isBulk ? (bulkReady ? total : 0n) : directReady ? total : 0n;
  const checkoutDisabled =
    !isConnected || phase !== 'open' || purchase.isPending || !(isBulk ? bulkReady : directReady);
  const activeBatch = bulk.orderInfo?.[0];
  const preview = staticTickets[0] ?? { normals: [...PREVIEW_NORMALS], bonusball: 1 };

  const setQuantity = (nextCount: number) => {
    const normalized = Math.min(50, Math.max(1, Math.trunc(nextCount)));
    setCount(normalized);
    if (normalized > BULK_THRESHOLD) setStaticTickets([]);
    else setStaticTickets((current) => current.slice(0, normalized));
  };

  const submit = () => {
    if (isBulk) void bulk.createOrder();
    else if (bounds) void direct.buy({ customTickets: staticTickets, count, bounds });
  };

  const confirmedTickets = isBulk ? bulk.confirmedTickets : direct.purchasedTickets;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {!isConnected && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {COPY.connectToBuy}
        </div>
      )}

      {phase !== 'open' && (
        <div className="rounded-xl border border-zinc-500 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
          {COPY.ticketsPaused}. Wait for the next drawing to open.
        </div>
      )}

      <section className="overflow-hidden rounded-[28px] border border-[#48568d] bg-[#101633] p-4 shadow-[6px_6px_0_#050713] sm:p-8">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9caef9]">
              MegaPlanets entry
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Play Megapot</h1>
          </div>
          {drawingId !== undefined && (
            <span className="rounded-full bg-[#202b5b] px-3 py-2 text-xs font-semibold text-[#dfe5ff]">
              Drawing #{drawingId.toString()}
            </span>
          )}
        </header>

        <div className="rounded-[26px] border border-[#8295e8] bg-[radial-gradient(circle_at_50%_0%,#8399ef_0%,#6075c6_36%,#343e84_100%)] px-5 py-8 shadow-inner sm:px-10">
          <div className="mx-auto max-w-md rounded-2xl border border-white/70 bg-[#f7f8ff] p-4 text-[#12182b] shadow-[0_12px_0_rgba(21,30,80,0.2)]">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#69738e]">
              <span>Numbers</span>
              <span>Bonus</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5">
                {preview.normals.map((number) => (
                  <Ball key={number} n={number} size="sm" />
                ))}
              </div>
              <Ball n={preview.bonusball} variant="bonus" size="sm" />
            </div>
          </div>
          <p className="mt-8 text-lg font-semibold text-[#10162d]">Guaranteed prizes</p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-semibold text-white">Tickets</h2>
          <div className="flex flex-wrap gap-2">
            {QUANTITY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuantity(preset)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${count === preset ? 'border-[#61b4ff] bg-[#18265d] text-white ring-2 ring-[#248cf2]' : 'border-[#4d5b93] bg-[#151b3d] text-[#dbe4ff] hover:bg-[#202a58]'}`}
              >
                {preset}
              </button>
            ))}
            <label
              className={`flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${!QUANTITY_PRESETS.includes(count as (typeof QUANTITY_PRESETS)[number]) ? 'border-[#61b4ff] bg-[#18265d] ring-2 ring-[#248cf2]' : 'border-[#4d5b93] bg-[#151b3d]'}`}
            >
              <span className="mr-2 text-[#dbe4ff]">Custom</span>
              <input
                aria-label="Custom ticket quantity"
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="w-10 bg-transparent text-center text-white outline-none"
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[22px] border border-[#4d5b93] bg-[#0b1028] p-3">
          <button
            type="button"
            onClick={() => setQuantity(count - 1)}
            disabled={count <= 1}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-[#202952] text-2xl text-white disabled:opacity-40"
            aria-label="Decrease ticket quantity"
          >
            −
          </button>
          <span className="text-3xl font-semibold tabular-nums text-white">{count}</span>
          <button
            type="button"
            onClick={() => setQuantity(count + 1)}
            disabled={count >= 50}
            className="grid h-12 w-12 place-items-center rounded-2xl bg-[#202952] text-2xl text-white disabled:opacity-40"
            aria-label="Increase ticket quantity"
          >
            +
          </button>
        </div>

        <div className="mt-4">
          <ApprovalButton
            spender={approvalSpender}
            amount={approvalAmount}
            onApproved={refetchJackpot}
          >
            <Button
              variant="primary"
              size="lg"
              onClick={submit}
              disabled={checkoutDisabled}
              className="w-full rounded-[24px] bg-[#0c1325] py-5 text-lg text-white shadow-none hover:bg-[#182242]"
            >
              {purchase.isWaitingSignature ? (
                'Sign in your wallet…'
              ) : purchase.isPreparing ? (
                'Preparing order…'
              ) : purchase.isMining ? (
                'Confirming on-chain…'
              ) : isBulk ? (
                <>
                  Buy {count} tickets · <UsdcAmount value={total} precision={2} />
                </>
              ) : (
                <>
                  Buy tickets · <UsdcAmount value={total} precision={2} />
                </>
              )}
            </Button>
          </ApprovalButton>
        </div>

        {isBulk ? (
          <p className="mt-5 text-center text-sm text-[#aab7e7]">
            ⓘ Numbers picked randomly for 11+ tickets. The keeper mints them in later transactions.
          </p>
        ) : (
          <div className="mt-5">
            <TicketBuilder
              ballMax={bounds?.ballMax}
              bonusballMax={bounds?.bonusballMax}
              count={count}
              staticTickets={staticTickets}
              onStaticTicketsChange={setStaticTickets}
            />
          </div>
        )}

        {isBulk && bulk.minimumTicketCount !== undefined && !meetsBulkMinimum && (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            Megapot currently requires at least {bulk.minimumTicketCount.toString()} tickets for a
            bulk order.
          </p>
        )}
        {isBulk && bulk.hasActiveOrder && (
          <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
            This wallet already has an active bulk order. Wait for execution or cancel it below.
          </p>
        )}

        <TxStatus
          hash={purchase.txHash}
          isPending={purchase.isPending}
          isSuccess={purchase.isSuccess}
          error={purchase.error}
        />

        {confirmedTickets.length > 0 && (
          <div className="mt-4 rounded-xl border border-brand-primary-500/50 bg-brand-primary-950/30 px-4 py-3 text-sm text-brand-primary-100">
            <p className="font-semibold">{confirmedTickets.length} tickets confirmed</p>
            <p className="mt-1 text-xs">
              {confirmedTickets.map((ticket) => `#${ticket.ticketId.toString()}`).join(' · ')}
            </p>
          </div>
        )}
      </section>

      {bulk.hasActiveOrder && activeBatch && (
        <section className="card-pad space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Active bulk order</h2>
              <p className="text-xs text-zinc-400">
                Keeper executions may arrive in multiple transactions.
              </p>
            </div>
            {bulk.createdOrder && (
              <a
                href={`${EXPLORER_TX_URL}${bulk.createdOrder.creationTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline underline-offset-2"
              >
                Creation tx
              </a>
            )}
          </div>
          <BulkProgress
            totalTickets={activeBatch.totalTicketsOrdered}
            remainingTickets={activeBatch.remainingTickets}
            remainingUSDC={activeBatch.remainingUSDC}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={bulk.cancelOrder}
            disabled={bulk.cancel.isPending}
          >
            {bulk.cancel.isWaitingSignature
              ? 'Sign cancellation…'
              : bulk.cancel.isMining
                ? 'Cancelling…'
                : 'Cancel remaining order and refund USDC'}
          </Button>
          <TxStatus
            hash={bulk.cancel.txHash}
            isPending={bulk.cancel.isPending}
            isSuccess={bulk.cancel.isSuccess}
            error={bulk.cancel.error}
          />
        </section>
      )}
    </div>
  );
}
