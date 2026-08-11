import { useMemo, useState, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { derivePlanetPreview, type PlanetPreview } from '@megaplanets/planet-generator';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { ExpeditionConfigurator } from '@/components/explore/ExpeditionConfigurator';
import { ExpeditionCompleteScreen, RevealCompleteScreen } from '@/components/explore/ExpeditionSuccessScreens';
import { BulkProgress } from '@/components/lottery/BulkProgress';
import { MintPlanetBatchButton } from '@/components/planets/MintPlanetBatchButton';
import { MintPlanetButton } from '@/components/planets/MintPlanetButton';
import { BATCH_PURCHASE_FACILITATOR_ADDRESS, EXPLORER_TX_URL, JACKPOT_ADDRESS } from '@/config/contracts';
import { COPY } from '@/config/copy';
import { PLANET_SEASON } from '@/config/planetSeason';
import { useBulkPurchase } from '@/hooks/useBulkPurchase';
import { useBuyTickets } from '@/hooks/useBuyTickets';
import { useEligiblePlanetTickets } from '@/hooks/useEligiblePlanetTickets';
import { useIndexedPlanets } from '@/hooks/useIndexedPlanets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { clampExpeditionQuantity } from '@/lib/expeditionFlow';
import { mergePlanetTickets } from '@/lib/planetTickets';
import { BULK_THRESHOLD, type CustomTicket, isValidTicket, totalCost } from '@/lib/tickets';

/** Purchase orchestration stays here; the configurator owns presentation-only controls. */
export function Play() {
  const { address, isConnected } = useAccount();
  const { state, drawingId, phase, refetch: refetchJackpot } = useJackpotState();
  const [count, setCount] = useState(3);
  const [automaticQuickPick, setAutomaticQuickPick] = useState(true);
  const [staticTickets, setStaticTickets] = useState<readonly CustomTicket[]>([]);
  const [revealedTicketIds, setRevealedTicketIds] = useState<ReadonlySet<string>>(() => new Set());

  const bounds = useMemo(() => state ? { ballMax: state.ballMax, bonusballMax: state.bonusballMax } : null, [state]);
  const isBulk = count > BULK_THRESHOLD;
  const bulk = useBulkPurchase(isBulk ? { dynamicCount: count, staticTickets: [] } : null);
  const direct = useBuyTickets();
  const validStaticTickets = bounds !== null && staticTickets.every((ticket) => isValidTicket(ticket, bounds));
  const manualSelectionComplete = automaticQuickPick || staticTickets.length === count;
  const directReady = !isBulk && bounds !== null && validStaticTickets && manualSelectionComplete && direct.isReady;
  const meetsBulkMinimum = bulk.minimumTicketCount !== undefined && BigInt(count) >= bulk.minimumTicketCount;
  const bulkReady = isBulk && meetsBulkMinimum && !bulk.hasActiveOrder && bulk.create.isReady;
  const total = state ? totalCost({ ticketPriceUsdcRaw: state.ticketPrice, count }) : 0n;
  const purchase = isBulk ? bulk.create : direct;
  const approvalSpender = isBulk ? BATCH_PURCHASE_FACILITATOR_ADDRESS : JACKPOT_ADDRESS;
  const approvalAmount = isBulk ? (bulkReady ? total : 0n) : directReady ? total : 0n;
  const checkoutDisabled = !isConnected || phase !== 'open' || purchase.isPending || !(isBulk ? bulkReady : directReady);
  const purchaseConfirmedTickets = isBulk ? bulk.confirmedTickets : direct.purchasedTickets;
  const recovered = useEligiblePlanetTickets(address, {
    refetchInterval: purchaseConfirmedTickets.length === 0 ? 5_000 : undefined,
  });
  const indexed = useIndexedPlanets(address);
  const indexedTicketIds = useMemo(
    () => new Set(indexed.planets.flatMap((planet) => planet.ticketId === null ? [] : [planet.ticketId])),
    [indexed.planets],
  );
  const confirmedTickets = useMemo(
    () => mergePlanetTickets(
      purchaseConfirmedTickets,
      recovered.tickets.filter(
        (ticket) => ticket.drawingId === drawingId && !indexedTicketIds.has(ticket.ticketId.toString()),
      ),
    ),
    [drawingId, indexedTicketIds, purchaseConfirmedTickets, recovered.tickets],
  );
  const activeBatch = bulk.orderInfo?.[0];

  const discoveredPlanets = useMemo(() => {
    const season = PLANET_SEASON;
    if (!season) return [] as { preview: PlanetPreview; logIndex: bigint | undefined }[];
    return confirmedTickets.flatMap((ticket) => {
      try { return [{ preview: derivePlanetPreview({ seasonId: season.seasonId, ticketId: ticket.ticketId, drawingId: ticket.drawingId, normals: ticket.normals, bonusBall: ticket.bonusBall, originTxHash: ticket.originTxHash }, season), logIndex: ticket.logIndex }]; } catch { return []; }
    });
  }, [confirmedTickets]);
  const allPlanetsRevealed = discoveredPlanets.length > 0 && discoveredPlanets.every(({ preview }) => revealedTicketIds.has(preview.descriptor.input.ticketId.toString()));

  const markRevealed = (ticketIds: readonly bigint[]) => {
    setRevealedTicketIds((current) => new Set([...current, ...ticketIds.map((ticketId) => ticketId.toString())]));
  };

  const setQuantity = (value: number) => {
    const next = clampExpeditionQuantity(value);
    setCount(next);
    if (next > BULK_THRESHOLD) { setStaticTickets([]); setAutomaticQuickPick(true); }
    else setStaticTickets((current) => current.slice(0, next));
  };
  const launch = () => { if (isBulk) void bulk.createOrder(); else if (bounds) void direct.buy({ customTickets: staticTickets, count, bounds }); };

  return <div className="mx-auto max-w-5xl space-y-2 pb-6">
    {!isConnected && <Notice>{COPY.connectToBuy}</Notice>}
    {phase !== 'open' && <Notice>{COPY.ticketsPaused}. Wait for the next drawing to open.</Notice>}
    {allPlanetsRevealed ? <RevealCompleteScreen planets={discoveredPlanets.map(({ preview }) => preview)} drawingId={drawingId} onViewPlanets={() => window.location.assign('/planets')} /> : confirmedTickets.length > 0 ? <ExpeditionCompleteScreen count={discoveredPlanets.length} revealAction={discoveredPlanets.length > 1 ? <MintPlanetBatchButton planets={discoveredPlanets} buttonLabel={`REVEAL (${discoveredPlanets.length})`} onMinted={markRevealed} /> : discoveredPlanets[0] ? <MintPlanetButton preview={discoveredPlanets[0].preview} logIndex={discoveredPlanets[0].logIndex} buttonLabel="REVEAL (1)" onMinted={(ticketId) => markRevealed([ticketId])} /> : null} /> : <ExpeditionConfigurator quantity={count} total={total} jackpotAmount={state?.prizePool} bounds={bounds} manuallyEditedTickets={staticTickets} automaticQuickPick={automaticQuickPick} disabled={checkoutDisabled} approvalSpender={approvalSpender} approvalAmount={approvalAmount} onApproved={refetchJackpot} onQuantityChange={setQuantity} onAutomaticQuickPickChange={setAutomaticQuickPick} onTicketsChange={setStaticTickets} onExplore={launch} />}
    {isBulk && bulk.minimumTicketCount !== undefined && !meetsBulkMinimum && <Notice>Megapot requires at least {bulk.minimumTicketCount.toString()} tickets for this order.</Notice>}
    {bulk.hasActiveOrder && activeBatch && <section className="mx-auto max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-hud font-semibold text-[var(--text-primary)]">Order in progress</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Tickets appear after their confirmed keeper transactions.</p></div>{bulk.createdOrder && <a className="text-sm font-semibold text-[var(--accent)]" href={`${EXPLORER_TX_URL}${bulk.createdOrder.creationTxHash}`} target="_blank" rel="noreferrer">View transaction</a>}</div><div className="mt-4"><BulkProgress totalTickets={activeBatch.totalTicketsOrdered} remainingTickets={activeBatch.remainingTickets} remainingUSDC={activeBatch.remainingUSDC} /></div><Button variant="secondary" size="sm" onClick={bulk.cancelOrder} disabled={bulk.cancel.isPending} className="mt-4">Cancel remaining order</Button><TxStatus hash={bulk.cancel.txHash} isPending={bulk.cancel.isPending} isSuccess={bulk.cancel.isSuccess} error={bulk.cancel.error} /></section>}
  </div>;
}

function Notice({ children }: { children: ReactNode }) { return <p className="mx-auto max-w-[560px] rounded-xl border border-[var(--warning)]/40 bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">{children}</p>; }
