import { ConnectButton } from '@rainbow-me/rainbowkit';
import { derivePlanetPreview, type PlanetPreview } from '@megaplanets/planet-generator';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import mineralIcon from '@/assets/mineral-icon.png';
import { Button } from '@/components/common/Button';
import { TxStatus } from '@/components/common/TxStatus';
import type { NavKey } from '@/components/layout/Nav';
import { PlanetInventoryCard } from '@/components/planets/PlanetInventoryCard';
import { PlanetInventoryDetail } from '@/components/planets/PlanetInventoryDetail';
import { LiveMineralAmount } from '@/components/planets/LiveMineralAmount';
import { MintPlanetButton } from '@/components/planets/MintPlanetButton';
import { PLANET_SEASON } from '@/config/planetSeason';
import { useEligiblePlanetTickets } from '@/hooks/useEligiblePlanetTickets';
import { useClaimWinnings } from '@/hooks/useClaimWinnings';
import { useIndexedPlanets } from '@/hooks/useIndexedPlanets';
import { useJackpotState } from '@/hooks/useJackpotState';
import { usePlanetTicketStatuses, type PlanetTicketStatus } from '@/hooks/usePlanetTicketStatuses';
import { useWalletMining } from '@/hooks/useWalletMining';
import { formatMinerals } from '@/lib/minerals';
import {
  sortPlanetInventory,
  sumMineralsPerDay,
  type PlanetInventoryItem,
  type PlanetSort,
} from '@/lib/planetInventory';
import { mergePlanetTickets } from '@/lib/planetTickets';
import { PURCHASED_TICKETS_UPDATED_EVENT, readPersistedPurchasedTickets } from '@/lib/purchaseReceipt';

type PlanetsProps = {
  onNavigate: (key: NavKey) => void;
  onViewPlanet: (tokenId: string) => void;
  routePlanetId?: string;
};

function isMobileViewport() {
  return window.matchMedia?.('(max-width: 767px)').matches ?? false;
}

const STATUS_UNAVAILABLE: PlanetTicketStatus = { kind: 'unavailable' };

function ConnectWalletPrompt() {
  return (
    <section className="card-pad mx-auto max-w-xl space-y-4 text-center">
      <h1 className="text-balance font-hud text-2xl font-bold">Connect your wallet to view your planets</h1>
      <ConnectButton.Custom>
        {({ openConnectModal, mounted }) => mounted ? (
          <Button variant="primary" onClick={openConnectModal}>Connect wallet</Button>
        ) : null}
      </ConnectButton.Custom>
    </section>
  );
}

export function Planets({ onNavigate, onViewPlanet, routePlanetId }: PlanetsProps) {
  const { address, isConnected } = useAccount();
  const [stored, setStored] = useState(() => ({
    tickets: [] as ReturnType<typeof readPersistedPurchasedTickets>['tickets'],
    invalidKeys: [] as readonly string[],
  }));
  const [sort, setSort] = useState<PlanetSort>('newest');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [mobileDetailTicketId, setMobileDetailTicketId] = useState<string | null>(null);
  const [revealedTicketIds, setRevealedTicketIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (!address) {
      setStored({ tickets: [], invalidKeys: [] });
      return;
    }
    const syncStoredTickets = () => setStored(readPersistedPurchasedTickets(address));
    const onTicketsUpdated = (event: Event) => {
      const account = (event as CustomEvent<{ account?: string }>).detail?.account;
      if (account === address.toLowerCase()) syncStoredTickets();
    };
    syncStoredTickets();
    window.addEventListener(PURCHASED_TICKETS_UPDATED_EVENT, onTicketsUpdated);
    return () => window.removeEventListener(PURCHASED_TICKETS_UPDATED_EVENT, onTicketsUpdated);
  }, [address]);

  const onChain = useEligiblePlanetTickets(address);
  const indexed = useIndexedPlanets(address);
  const mining = useWalletMining(address);
  const jackpot = useJackpotState();
  const eligibleTickets = useMemo(
    () => mergePlanetTickets(
      stored.tickets.filter((ticket): ticket is typeof ticket & {
        originTxHash: NonNullable<typeof ticket.originTxHash>;
        logIndex: NonNullable<typeof ticket.logIndex>;
      } => ticket.originTxHash !== null && ticket.logIndex !== null),
      onChain.tickets,
    ),
    [stored.tickets, onChain.tickets],
  );
  const indexedTickets = useMemo(
    () => indexed.planets.flatMap((planet) => !planet.ticket || planet.ticketId === null ? [] : [{
      ticketId: BigInt(planet.ticketId),
      drawingId: BigInt(planet.ticket.drawingId),
      normals: planet.ticket.normals,
      bonusBall: planet.ticket.bonusBall,
      originTxHash: planet.ticket.originTxHash,
      logIndex: 0n,
    }]),
    [indexed.planets],
  );
  const tickets = useMemo(() => mergePlanetTickets(eligibleTickets, indexedTickets), [eligibleTickets, indexedTickets]);
  const ticketRefs = useMemo(() => tickets.map((ticket) => ({ ticketId: ticket.ticketId.toString(), drawingId: ticket.drawingId.toString() })), [tickets]);
  const ticketStatuses = usePlanetTicketStatuses(address, ticketRefs, {
    drawingId: jackpot.drawingId,
    phase: jackpot.phase,
    drawingTime: jackpot.state?.drawingTime,
  });
  const claim = useClaimWinnings();

  useEffect(() => {
    if (!claim.isSuccess) return;
    void ticketStatuses.refetch();
    claim.reset();
  }, [claim.isSuccess, claim.reset, ticketStatuses.refetch]);
  const indexedByTicketId = useMemo(
    () => new Map(indexed.planets.flatMap((planet) => planet.ticketId === null ? [] : [[planet.ticketId, planet] as const])),
    [indexed.planets],
  );

  const gallery = useMemo(() => {
    const previews: PlanetPreview[] = [];
    let ignoredCount = 0;
    if (!PLANET_SEASON) return { previews, ignoredCount };
    for (const ticket of tickets) {
      try {
        previews.push(derivePlanetPreview({
          seasonId: PLANET_SEASON.seasonId,
          ticketId: ticket.ticketId,
          drawingId: ticket.drawingId,
          normals: ticket.normals,
          bonusBall: ticket.bonusBall,
          originTxHash: ticket.originTxHash,
        }, PLANET_SEASON));
      } catch {
        ignoredCount += 1;
      }
    }
    return { previews, ignoredCount };
  }, [tickets]);

  const inventory = useMemo<PlanetInventoryItem[]>(() => gallery.previews.map((preview) => {
    const ticketId = preview.descriptor.input.ticketId.toString();
    const indexedPlanet = indexedByTicketId.get(ticketId);
    return {
      preview,
      ticketId,
      drawingId: preview.descriptor.input.drawingId.toString(),
      tokenId: indexedPlanet?.tokenId,
      mintedAt: indexedPlanet?.mintedAt,
      revealed: indexedPlanet !== undefined || revealedTicketIds.has(ticketId),
    };
  }), [gallery.previews, indexedByTicketId, revealedTicketIds]);
  const sortedInventory = useMemo(() => sortPlanetInventory(inventory, sort), [inventory, sort]);

  useEffect(() => {
    if (routePlanetId) {
      const routeItem = inventory.find((item) => item.tokenId === routePlanetId);
      if (routeItem && routeItem.ticketId !== selectedTicketId) setSelectedTicketId(routeItem.ticketId);
      return;
    }
    if (!inventory.some((item) => item.ticketId === selectedTicketId)) {
      setSelectedTicketId(sortedInventory[0]?.ticketId ?? null);
    }
  }, [inventory, routePlanetId, selectedTicketId, sortedInventory]);

  const selected = routePlanetId
    ? inventory.find((item) => item.tokenId === routePlanetId)
    : inventory.find((item) => item.ticketId === selectedTicketId) ?? sortedInventory[0];
  const selectedStatus = selected ? ticketStatuses.statuses.get(selected.ticketId) ?? STATUS_UNAVAILABLE : STATUS_UNAVAILABLE;
  const miningByTokenId = useMemo(
    () => new Map((mining.data?.planets ?? []).map((planet) => [planet.tokenId, planet] as const)),
    [mining.data?.planets],
  );
  const selectedMining = selected?.revealed && selected.tokenId ? miningByTokenId.get(selected.tokenId) : undefined;

  const markRevealed = (ticketIds: readonly bigint[]) => {
    setRevealedTicketIds((current) => new Set([...current, ...ticketIds.map(String)]));
  };
  const mintAction = (preview: PlanetPreview) => (
    <MintPlanetButton
      preview={preview}
      logIndex={tickets.find((ticket) => ticket.ticketId === preview.descriptor.input.ticketId)?.logIndex}
      buttonLabel="MINT"
      onMinted={(ticketId) => markRevealed([ticketId])}
    />
  );
  const selectPlanet = (item: PlanetInventoryItem) => {
    setSelectedTicketId(item.ticketId);
    if (!isMobileViewport()) return;
    if (item.tokenId) onViewPlanet(item.tokenId);
    else setMobileDetailTicketId(item.ticketId);
  };
  const runSelectedStatusAction = () => {
    if (selectedStatus.kind === 'claim') {
      void claim.claim([selectedStatus.ticketId]);
      return;
    }
    onNavigate('history');
  };

  if (!isConnected || !address) return <ConnectWalletPrompt />;
  if (!PLANET_SEASON) {
    return <div className="rounded-lg border border-amber-900 bg-amber-950 px-4 py-3 text-sm text-amber-100">Planet generation is unavailable until the deployment Season ID is configured.</div>;
  }
  if (routePlanetId && indexed.isLoading) {
    return <section className="card-pad mx-auto max-w-xl space-y-3 text-center"><h1 className="text-2xl font-semibold">Loading planet details</h1><p className="text-sm text-zinc-400">Resolving Planet #{routePlanetId} from the indexed collection.</p></section>;
  }
  if (routePlanetId && indexed.error && !selected) {
    return <section className="card-pad mx-auto max-w-xl space-y-4 text-center"><h1 className="text-2xl font-semibold">Planet details unavailable</h1><p className="text-sm text-zinc-400">The indexed collection could not be reached. Try again when the service is available.</p><Button variant="secondary" onClick={() => onNavigate('planets')}>Back to My Planets</Button></section>;
  }
  if ((onChain.isLoading || indexed.isLoading) && inventory.length === 0) {
    return <section className="card-pad mx-auto max-w-2xl space-y-3 text-center"><h1 className="text-balance text-2xl font-semibold">Discovering your planets</h1><p className="text-pretty text-sm text-zinc-400">Reading confirmed MegaPlanets ticket events from Base Sepolia.</p></section>;
  }
  if (indexed.error && inventory.length === 0) {
    return <section className="card-pad mx-auto max-w-2xl space-y-3 text-center"><h1 className="text-balance text-2xl font-semibold">Planet collection unavailable</h1><p className="text-pretty text-sm text-zinc-400">The indexed collection could not be reached, so an empty wallet cannot be confirmed.</p></section>;
  }
  if (inventory.length === 0) {
    return <section className="card-pad mx-auto max-w-2xl space-y-4 text-center"><h1 className="text-balance text-2xl font-semibold">No planets yet</h1><p className="text-pretty text-sm text-zinc-400">Explore a ticket coordinate and return here after it is confirmed.</p>{onChain.error ? <p className="text-pretty text-sm text-rose-300">Could not read ticket events. Check your RPC connection and retry.</p> : null}<Button variant="primary" onClick={() => onNavigate('play')}>Explore planets</Button></section>;
  }
  if (routePlanetId && !selected) {
    return <section className="card-pad mx-auto max-w-xl space-y-4 text-center"><h1 className="text-2xl font-semibold">Planet not found</h1><Button variant="secondary" onClick={() => onNavigate('planets')}>Back to My Planets</Button></section>;
  }

  const detail = selected ? (
    <div>
      <PlanetInventoryDetail
        preview={selected.preview}
        tokenId={selected.tokenId}
        revealed={selected.revealed}
        ticketStatus={selectedStatus}
        mintAction={mintAction(selected.preview)}
        onStatusAction={runSelectedStatusAction}
        statusPending={claim.isPending}
        onViewDetails={selected.tokenId ? () => onViewPlanet(selected.tokenId as string) : undefined}
        onBack={routePlanetId ? () => onNavigate('planets') : mobileDetailTicketId ? () => setMobileDetailTicketId(null) : undefined}
        mining={selectedMining}
        miningAsOf={mining.data?.asOf}
      />
      <TxStatus hash={claim.txHash} isPending={claim.isPending} isSuccess={claim.isSuccess} error={claim.error} />
    </div>
  ) : null;

  if (routePlanetId || mobileDetailTicketId) return <div className="mx-auto max-w-2xl">{detail}</div>;

  const revealedItems = inventory.filter((item) => item.revealed);
  const totalMinerals = sumMineralsPerDay(inventory);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="font-hud text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">My Planets</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
            <span>{revealedItems.length} {revealedItems.length === 1 ? 'planet' : 'planets'}</span>
            {mining.data ? (
              <>
                <LiveMineralAmount prefix="Mined" snapshotMicros={mining.data.earnedMicros} effectiveMineralsPerDayMicros={mining.data.effectiveMineralsPerDayMicros} asOf={mining.data.asOf} className="font-semibold text-[var(--text-primary)]" />
                <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                  <img src={mineralIcon} alt="Minerals" className="h-5 w-5 object-contain invert" />
                  {formatMinerals(BigInt(mining.data.effectiveMineralsPerDayMicros))}/day
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                <img src={mineralIcon} alt="Minerals" className="h-5 w-5 object-contain invert" />
                {totalMinerals.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>Sort</span>
          <select
            aria-label="Sort planets"
            value={sort}
            onChange={(event) => setSort(event.target.value as PlanetSort)}
            className="min-h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm font-semibold text-[var(--text-primary)]"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="minerals">Minerals</option>
            <option value="rarity">Rarity</option>
          </select>
        </label>
      </header>

      {stored.invalidKeys.length > 0 || gallery.ignoredCount > 0 ? <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">{stored.invalidKeys.length + gallery.ignoredCount} malformed or provenance-incomplete local record(s) were ignored.</div> : null}
      {indexed.error ? <div className="rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">The indexed collection is temporarily unavailable. Eligible ticket previews remain visible, but minted ownership cannot be confirmed.</div> : null}
      {ticketStatuses.error ? <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">Ticket statuses are temporarily unavailable. Planet ownership and ticket provenance are unaffected.</div> : null}
      {mining.error ? <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">Mining totals are temporarily unavailable. Planet ownership and ticket actions are unaffected.</div> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.85fr)]">
        <section aria-label="Planet collection">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedInventory.map((item) => (
              <PlanetInventoryCard
                key={item.ticketId}
                preview={item.preview}
                tokenId={item.tokenId}
                revealed={item.revealed}
                ticketStatus={ticketStatuses.statuses.get(item.ticketId) ?? STATUS_UNAVAILABLE}
                selected={item.ticketId === selected?.ticketId}
                onSelect={() => selectPlanet(item)}
                mintAction={item.revealed ? null : mintAction(item.preview)}
                effectiveMineralsPerDayMicros={item.revealed && item.tokenId ? miningByTokenId.get(item.tokenId)?.effectiveMineralsPerDayMicros : undefined}
              />
            ))}
          </div>
        </section>
        <aside aria-label="Selected planet detail" className="hidden md:block lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">{detail}</aside>
      </div>
    </div>
  );
}
