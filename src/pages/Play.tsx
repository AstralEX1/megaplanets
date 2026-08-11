import { derivePlanetPreview, type PlanetPreview } from '@megaplanets/planet-generator';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import { ExpeditionConfigurator } from '@/components/explore/ExpeditionConfigurator';
import {
  ExpeditionCompleteScreen,
  RevealCompleteScreen,
} from '@/components/explore/ExpeditionSuccessScreens';
import { BulkProgress } from '@/components/lottery/BulkProgress';
import { MintPlanetBatchButton } from '@/components/planets/MintPlanetBatchButton';
import { MintPlanetButton } from '@/components/planets/MintPlanetButton';
import { PlanetInventoryCard } from '@/components/planets/PlanetInventoryCard';
import {
  BATCH_PURCHASE_FACILITATOR_ADDRESS,
  EXPLORER_TX_URL,
  JACKPOT_ADDRESS,
} from '@/config/contracts';
import { COPY } from '@/config/copy';
import { PLANET_SEASON } from '@/config/planetSeason';
import { useBulkPurchase } from '@/hooks/useBulkPurchase';
import { useBuyTickets } from '@/hooks/useBuyTickets';
import { useEligiblePlanetTickets } from '@/hooks/useEligiblePlanetTickets';
import { useExpeditionAnimation } from '@/hooks/useExpeditionAnimation';
import { useIndexedPlanets } from '@/hooks/useIndexedPlanets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { usePlanetTicketStatuses } from '@/hooks/usePlanetTicketStatuses';
import {
  clampExpeditionQuantity,
  deriveExpeditionFlow,
  type RevealFlowState,
} from '@/lib/expeditionFlow';
import {
  clearExpeditionSession,
  readExpeditionSession,
  writeExpeditionSession,
  type ExpeditionSessionV1,
} from '@/lib/expeditionSession';
import { mergePlanetTickets } from '@/lib/planetTickets';
import { BULK_THRESHOLD, type CustomTicket, isValidTicket, totalCost } from '@/lib/tickets';

type DiscoveredPlanet = { preview: PlanetPreview; logIndex: bigint | undefined };

/** Purchase orchestration stays here; the expedition screens consume only hook-derived state. */
export function Play() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { state, drawingId, phase, refetch: refetchJackpot } = useJackpotState();
  const [count, setCount] = useState(3);
  const [automaticQuickPick, setAutomaticQuickPick] = useState(true);
  const [staticTickets, setStaticTickets] = useState<readonly CustomTicket[]>([]);
  const [flowActive, setFlowActive] = useState(false);
  const [session, setSession] = useState<ExpeditionSessionV1 | null>(null);
  const [revealedTicketIds, setRevealedTicketIds] = useState<ReadonlySet<string>>(() => new Set());
  const [revealState, setRevealState] = useState<RevealFlowState>('idle');

  const bounds = useMemo(
    () => (state ? { ballMax: state.ballMax, bonusballMax: state.bonusballMax } : null),
    [state],
  );
  const isBulk = count > BULK_THRESHOLD;
  const bulkDraft = isBulk
    ? { dynamicCount: count, staticTickets: [] }
    : session?.purchaseMode === 'bulk'
      ? { dynamicCount: session.quantity, staticTickets: [] }
      : null;
  const bulk = useBulkPurchase(bulkDraft);
  const direct = useBuyTickets();
  const validStaticTickets =
    bounds !== null && staticTickets.every((ticket) => isValidTicket(ticket, bounds));
  const manualSelectionComplete = automaticQuickPick || staticTickets.length === count;
  const directReady =
    !isBulk && bounds !== null && validStaticTickets && manualSelectionComplete && direct.isReady;
  const meetsBulkMinimum =
    bulk.minimumTicketCount !== undefined && BigInt(count) >= bulk.minimumTicketCount;
  const bulkReady = isBulk && meetsBulkMinimum && !bulk.hasActiveOrder && bulk.create.isReady;
  const total = state ? totalCost({ ticketPriceUsdcRaw: state.ticketPrice, count }) : 0n;
  const purchase = isBulk ? bulk.create : direct;
  const approvalSpender = isBulk ? BATCH_PURCHASE_FACILITATOR_ADDRESS : JACKPOT_ADDRESS;
  const approvalAmount = isBulk ? (bulkReady ? total : 0n) : directReady ? total : 0n;
  const checkoutDisabled =
    !isConnected || phase !== 'open' || purchase.isPending || !(isBulk ? bulkReady : directReady);
  const recovered = useEligiblePlanetTickets(address, {
    refetchInterval: flowActive ? 5_000 : undefined,
  });
  const indexed = useIndexedPlanets(address);
  const indexedTicketIds = useMemo(
    () =>
      new Set(
        indexed.planets.flatMap((planet) => (planet.ticketId === null ? [] : [planet.ticketId])),
      ),
    [indexed.planets],
  );
  const expectedCount = session?.quantity ?? count;
  const candidateTickets = useMemo(
    () =>
      mergePlanetTickets(
        isBulk ? bulk.confirmedTickets : direct.purchasedTickets,
        recovered.tickets.filter(
          (ticket) =>
            ticket.drawingId === drawingId && !indexedTicketIds.has(ticket.ticketId.toString()),
        ),
      ),
    [
      bulk.confirmedTickets,
      direct.purchasedTickets,
      drawingId,
      indexedTicketIds,
      isBulk,
      recovered.tickets,
    ],
  );
  const sessionCandidateCount = useMemo(() => {
    if (!session) return 0;
    if (session.purchaseMode === 'direct' && session.purchaseTxHash) {
      return recovered.tickets.filter(
        (ticket) =>
          ticket.drawingId.toString() === session.drawingId &&
          ticket.originTxHash.toLowerCase() === session.purchaseTxHash?.toLowerCase(),
      ).length;
    }
    return recovered.tickets.filter((ticket) => ticket.drawingId.toString() === session.drawingId)
      .length;
  }, [recovered.tickets, session]);
  const confirmedTickets = useMemo(() => {
    if (!flowActive) return [];
    if (session?.purchaseMode === 'direct' && session.purchaseTxHash) {
      return candidateTickets
        .filter(
          (ticket) => ticket.originTxHash.toLowerCase() === session.purchaseTxHash?.toLowerCase(),
        )
        .slice(0, expectedCount);
    }
    return candidateTickets.slice(-expectedCount);
  }, [candidateTickets, expectedCount, flowActive, session]);
  const activeBatch = bulk.orderInfo?.[0];

  useEffect(() => {
    if (!address) {
      setSession(null);
      setFlowActive(false);
      return;
    }
    setSession(readExpeditionSession(address, chainId));
    setFlowActive(false);
  }, [address, chainId]);

  useEffect(() => {
    if (!session?.purchaseTxHash || session.purchaseMode !== 'direct' || !address) return;
    const indexedFromPurchase = indexed.planets.filter(
      (planet) =>
        planet.ticket?.originTxHash.toLowerCase() === session.purchaseTxHash?.toLowerCase(),
    ).length;
    if (indexedFromPurchase < session.quantity) return;
    clearExpeditionSession(address, chainId);
    setSession(null);
  }, [address, chainId, indexed.planets, session]);

  useEffect(() => {
    if (!session || !address) return;
    const txHash = session.purchaseMode === 'bulk' ? bulk.create.txHash : direct.txHash;
    if (!txHash || session.purchaseTxHash === txHash) return;
    const next = {
      ...session,
      purchaseTxHash: txHash,
      bulkOrderReference: session.purchaseMode === 'bulk' ? txHash : null,
    };
    writeExpeditionSession(next);
    setSession(next);
  }, [address, bulk.create.txHash, direct.txHash, session]);

  const discoveredPlanets = useMemo<readonly DiscoveredPlanet[]>(() => {
    const season = PLANET_SEASON;
    if (!season) return [];
    return confirmedTickets.flatMap((ticket) => {
      try {
        return [
          {
            preview: derivePlanetPreview(
              {
                seasonId: season.seasonId,
                ticketId: ticket.ticketId,
                drawingId: ticket.drawingId,
                normals: ticket.normals,
                bonusBall: ticket.bonusBall,
                originTxHash: ticket.originTxHash,
              },
              season,
            ),
            logIndex: ticket.logIndex,
          },
        ];
      } catch {
        return [];
      }
    });
  }, [confirmedTickets]);
  const allPlanetsRevealed =
    discoveredPlanets.length >= expectedCount &&
    discoveredPlanets.every(({ preview }) =>
      revealedTicketIds.has(preview.descriptor.input.ticketId.toString()),
    );
  const resultRefs = useMemo(
    () =>
      discoveredPlanets.map(({ preview }) => ({
        ticketId: preview.descriptor.input.ticketId.toString(),
        drawingId: preview.descriptor.input.drawingId.toString(),
      })),
    [discoveredPlanets],
  );
  const ticketStatuses = usePlanetTicketStatuses(address, resultRefs, {
    drawingId,
    phase,
    drawingTime: state?.drawingTime,
  });
  const indexedByTicketId = useMemo(
    () =>
      new Map(
        indexed.planets.flatMap((planet) =>
          planet.ticketId ? [[planet.ticketId, planet] as const] : [],
        ),
      ),
    [indexed.planets],
  );

  const purchaseConfirmed = isBulk
    ? bulk.create.isSuccess || bulk.hasActiveOrder || activeBatch !== undefined
    : direct.isSuccess;
  const purchaseError = purchase.error ?? null;
  const normalizedRevealState: RevealFlowState = allPlanetsRevealed ? 'complete' : revealState;
  const flow = deriveExpeditionFlow({
    isActive: flowActive,
    expectedTicketCount: expectedCount,
    confirmedTicketCount: confirmedTickets.length,
    isBulkOrder: isBulk,
    isWaitingSignature: purchase.isWaitingSignature || purchase.isPreparing,
    isMiningPurchase: purchase.isMining,
    isPurchaseConfirmed: purchaseConfirmed,
    revealState: normalizedRevealState,
    error: purchaseError,
  });
  useExpeditionAnimation(flow.scene);

  const markRevealed = useCallback(
    (ticketIds: readonly bigint[]) => {
      setRevealedTicketIds((current) => new Set([...current, ...ticketIds.map(String)]));
      if (address) clearExpeditionSession(address, chainId);
    },
    [address, chainId],
  );
  const handleRevealState = useCallback(
    (next: 'idle' | 'wallet-confirmation' | 'confirming' | 'complete' | 'error') => {
      setRevealState(next);
    },
    [],
  );

  const setQuantity = (value: number) => {
    const next = clampExpeditionQuantity(value);
    setCount(next);
    if (next > BULK_THRESHOLD) {
      setStaticTickets([]);
      setAutomaticQuickPick(true);
    } else setStaticTickets((current) => current.slice(0, next));
  };
  const launch = () => {
    if (!address || drawingId === undefined) return;
    const next: ExpeditionSessionV1 = {
      version: 1,
      account: address,
      chainId,
      purchaseMode: isBulk ? 'bulk' : 'direct',
      drawingId: drawingId.toString(),
      quantity: count,
      automaticQuickPick,
      coordinates: staticTickets,
      purchaseTxHash: null,
      bulkOrderReference: null,
      createdAt: Date.now(),
    };
    writeExpeditionSession(next);
    setSession(next);
    setFlowActive(true);
    setRevealState('idle');
    if (isBulk) void bulk.createOrder();
    else if (bounds) void direct.buy({ customTickets: staticTickets, count, bounds });
  };
  const resume = () => {
    if (!session) return;
    setCount(session.quantity);
    setAutomaticQuickPick(session.automaticQuickPick);
    setStaticTickets(session.coordinates);
    setFlowActive(true);
  };
  const retry = () => {
    purchase.reset();
    launch();
  };
  const exploreAgain = () => {
    if (address) clearExpeditionSession(address, chainId);
    direct.reset();
    bulk.create.reset();
    setSession(null);
    setFlowActive(false);
    setRevealState('idle');
    setRevealedTicketIds(new Set());
  };

  const revealAction =
    discoveredPlanets.length > 1 ? (
      <MintPlanetBatchButton
        planets={discoveredPlanets}
        buttonLabel={`REVEAL (${discoveredPlanets.length})`}
        onMinted={markRevealed}
        onStateChange={handleRevealState}
      />
    ) : discoveredPlanets[0] ? (
      <MintPlanetButton
        preview={discoveredPlanets[0].preview}
        logIndex={discoveredPlanets[0].logIndex}
        buttonLabel="REVEAL (1)"
        onMinted={(ticketId) => markRevealed([ticketId])}
        onStateChange={handleRevealState}
      />
    ) : null;
  const issuedCount = activeBatch
    ? Number(activeBatch.totalTicketsOrdered - activeBatch.remainingTickets)
    : confirmedTickets.length;
  const progress = `${Math.min(issuedCount, expectedCount)} / ${expectedCount}`;
  const purchaseInline = flow.step !== 'reveal';
  const mysteryVisible =
    flow.scene === 'signals-located' ||
    flow.scene === 'reveal-wallet-confirmation' ||
    flow.scene === 'confirming-reveal' ||
    (flow.scene === 'recoverable-error' && revealState === 'error');
  const exploreLabel = purchaseInline ? purchaseProgressLabel(flow.scene, progress) : undefined;
  const inlineRetry = flow.scene === 'recoverable-error' && revealState !== 'error';

  let content: ReactNode;
  if (purchaseInline) {
    content = (
      <>
        {session && !flowActive ? (
          <section className="mx-auto mb-4 flex max-w-[720px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--primary)]/50 bg-[var(--surface-raised)] px-4 py-3">
            <div>
              <p className="font-hud font-bold text-[var(--text-primary)]">
                {sessionCandidateCount >= session.quantity
                  ? `${session.quantity} planets ready to reveal`
                  : 'Expedition in progress'}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Progress will be verified from Base Sepolia before continuing.
              </p>
            </div>
            <Button size="sm" onClick={resume}>
              Resume
            </Button>
          </section>
        ) : null}
        <ExpeditionConfigurator
          quantity={count}
          total={total}
          jackpotAmount={state?.prizePool}
          bounds={bounds}
          manuallyEditedTickets={staticTickets}
          automaticQuickPick={automaticQuickPick}
          disabled={flowActive && !inlineRetry ? true : checkoutDisabled}
          exploreLabel={exploreLabel}
          approvalSpender={approvalSpender}
          approvalAmount={approvalAmount}
          onApproved={refetchJackpot}
          onQuantityChange={setQuantity}
          onAutomaticQuickPickChange={setAutomaticQuickPick}
          onTicketsChange={setStaticTickets}
          onExplore={inlineRetry ? retry : launch}
        />
      </>
    );
  } else if (mysteryVisible) {
    content = (
      <ExpeditionCompleteScreen count={discoveredPlanets.length} revealAction={revealAction} />
    );
  } else if (flow.scene === 'results') {
    content = (
      <RevealCompleteScreen
        drawingId={drawingId}
        onExploreAgain={exploreAgain}
        onViewPlanets={() => window.location.assign('/my-planets')}
        cards={
          <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
            {discoveredPlanets.map(({ preview }, index) => {
              const ticketId = preview.descriptor.input.ticketId.toString();
              const indexedPlanet = indexedByTicketId.get(ticketId);
              return (
                <div
                  key={ticketId}
                  className="expedition-result-card"
                  style={{ animationDelay: `${Math.min(index * 45, 900)}ms` }}
                >
                  <PlanetInventoryCard
                    preview={preview}
                    tokenId={indexedPlanet?.tokenId}
                    revealed
                    ticketStatus={ticketStatuses.statuses.get(ticketId) ?? { kind: 'unavailable' }}
                    selected={false}
                    onSelect={() =>
                      window.location.assign(
                        indexedPlanet?.tokenId ? `/planet/${indexedPlanet.tokenId}` : '/my-planets',
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        }
      />
    );
  } else content = null;

  return (
    <div className="mx-auto max-w-5xl space-y-2 pb-6">
      {!isConnected && <Notice>{COPY.connectToBuy}</Notice>}
      {phase !== 'open' && (
        <Notice>{COPY.ticketsPaused}. Wait for the next drawing to open.</Notice>
      )}
      {content}
      {isBulk && bulk.minimumTicketCount !== undefined && !meetsBulkMinimum && !flowActive && (
        <Notice>
          Megapot requires at least {bulk.minimumTicketCount.toString()} tickets for this order.
        </Notice>
      )}
      {flowActive && isBulk && bulk.hasActiveOrder && activeBatch ? (
        <section className="mx-auto max-w-[560px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <BulkProgress
            totalTickets={activeBatch.totalTicketsOrdered}
            remainingTickets={activeBatch.remainingTickets}
            remainingUSDC={activeBatch.remainingUSDC}
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={bulk.cancelOrder}
              disabled={bulk.cancel.isPending}
            >
              Cancel remaining order
            </Button>
            {bulk.createdOrder ? (
              <a
                className="text-sm font-semibold text-[var(--accent)]"
                href={`${EXPLORER_TX_URL}${bulk.createdOrder.creationTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            ) : null}
          </div>
          <TxStatus
            hash={bulk.cancel.txHash}
            isPending={bulk.cancel.isPending}
            isSuccess={bulk.cancel.isSuccess}
            error={bulk.cancel.error}
          />
        </section>
      ) : null}
    </div>
  );
}

function purchaseProgressLabel(
  scene: ReturnType<typeof deriveExpeditionFlow>['scene'],
  progress: string,
) {
  switch (scene) {
    case 'wallet-confirmation':
      return 'Confirm in wallet';
    case 'confirming-purchase':
      return 'Confirming purchase…';
    case 'discovering-planets':
    case 'verifying-tickets':
      return `Discovering planets ${progress}`;
    case 'recoverable-error':
      return 'Retry';
    default:
      return undefined;
  }
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto max-w-[560px] rounded-xl border border-[var(--warning)]/40 bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
      {children}
    </p>
  );
}
