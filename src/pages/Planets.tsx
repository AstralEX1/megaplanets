import { derivePlanetPreview, type PlanetPreview } from '@megaplanets/planet-generator';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import type { NavKey } from '@/components/layout/Nav';
import { PlanetInventoryCard } from '@/components/planets/PlanetInventoryCard';
import { PlanetInventoryDetail } from '@/components/planets/PlanetInventoryDetail';
import { MintPlanetButton } from '@/components/planets/MintPlanetButton';
import { COPY } from '@/config/copy';
import { EXPLORER_ADDRESS_URL, MEGAPLANETS_CONTRACT_ADDRESS } from '@/config/contracts';
import { PLANET_SEASON } from '@/config/planetSeason';
import { useEligiblePlanetTickets } from '@/hooks/useEligiblePlanetTickets';
import { useIndexedPlanets } from '@/hooks/useIndexedPlanets';
import { usePlanetDrawingStates } from '@/hooks/usePlanetDrawingStates';
import { mergePlanetTickets } from '@/lib/planetTickets';
import { PURCHASED_TICKETS_UPDATED_EVENT, readPersistedPurchasedTickets } from '@/lib/purchaseReceipt';

const INITIAL_PREVIEW_COUNT = 12;
const PREVIEW_PAGE_SIZE = 12;

export function Planets({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const { address, isConnected } = useAccount();
  const [stored, setStored] = useState(() => ({ tickets: [] as ReturnType<typeof readPersistedPurchasedTickets>['tickets'], invalidKeys: [] as readonly string[] }));
  const [visiblePreviewCount, setVisiblePreviewCount] = useState(INITIAL_PREVIEW_COUNT);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
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
  const eligibleTickets = useMemo(() => mergePlanetTickets(stored.tickets.filter((ticket): ticket is typeof ticket & { originTxHash: NonNullable<typeof ticket.originTxHash>; logIndex: NonNullable<typeof ticket.logIndex> } => ticket.originTxHash !== null && ticket.logIndex !== null), onChain.tickets), [stored.tickets, onChain.tickets]);
  const indexedTickets = useMemo(() => indexed.planets.flatMap((planet) => !planet.ticket || planet.ticketId === null ? [] : [{ ticketId: BigInt(planet.ticketId), drawingId: BigInt(planet.ticket.drawingId), normals: planet.ticket.normals, bonusBall: planet.ticket.bonusBall, originTxHash: planet.ticket.originTxHash, logIndex: 0n }]), [indexed.planets]);
  const tickets = useMemo(() => mergePlanetTickets(eligibleTickets, indexedTickets), [eligibleTickets, indexedTickets]);
  const drawingStates = usePlanetDrawingStates(tickets.map((ticket) => ticket.drawingId));
  const indexedTokenIds = useMemo(() => new Set(indexed.planets.map((planet) => planet.tokenId)), [indexed.planets]);
  const gallery = useMemo(() => {
    const previews: PlanetPreview[] = [];
    let ignoredCount = 0;
    if (!PLANET_SEASON) return { previews, ignoredCount };
    for (const ticket of tickets.slice(0, visiblePreviewCount)) {
      try {
        previews.push(derivePlanetPreview({ seasonId: PLANET_SEASON.seasonId, ticketId: ticket.ticketId, drawingId: ticket.drawingId, normals: ticket.normals, bonusBall: ticket.bonusBall, originTxHash: ticket.originTxHash }, PLANET_SEASON));
      } catch {
        ignoredCount += 1;
      }
    }
    return { previews, ignoredCount };
  }, [tickets, visiblePreviewCount]);

  useEffect(() => {
    if (!gallery.previews.some(({ descriptor }) => descriptor.input.ticketId.toString() === selectedTicketId)) setSelectedTicketId(gallery.previews[0]?.descriptor.input.ticketId.toString() ?? null);
  }, [gallery.previews, selectedTicketId]);

  const selected = gallery.previews.find(({ descriptor }) => descriptor.input.ticketId.toString() === selectedTicketId);
  const isRevealed = (ticketId: string) => indexedTokenIds.has(ticketId) || revealedTicketIds.has(ticketId);
  const markRevealed = (ticketIds: readonly bigint[]) => setRevealedTicketIds((current) => new Set([...current, ...ticketIds.map(String)]));
  const mintAction = (preview: PlanetPreview) => <MintPlanetButton preview={preview} logIndex={tickets.find((ticket) => ticket.ticketId === preview.descriptor.input.ticketId)?.logIndex} buttonLabel="MINT" onMinted={(ticketId) => markRevealed([ticketId])} />;

  if (!isConnected || !address) return <div className="rounded-lg border border-amber-900 bg-amber-950 px-4 py-3 text-sm text-amber-100">{COPY.connectToViewPlanets}</div>;
  if (!PLANET_SEASON) return <div className="rounded-lg border border-amber-900 bg-amber-950 px-4 py-3 text-sm text-amber-100">Planet generation is unavailable until the deployment Season ID is configured.</div>;
  if ((onChain.isLoading || indexed.isLoading) && gallery.previews.length === 0) return <section className="card-pad mx-auto max-w-2xl space-y-3 text-center"><h1 className="text-2xl font-semibold">Discovering your planets</h1><p className="text-sm text-zinc-400">Reading confirmed MegaPlanets ticket events from Base Sepolia.</p></section>;
  if (gallery.previews.length === 0) return <section className="card-pad mx-auto max-w-2xl space-y-4 text-center"><h1 className="text-2xl font-semibold">No planets discovered yet</h1><p className="text-sm text-zinc-400">No eligible MegaPlanets ticket was found for this wallet on Base Sepolia.</p>{onChain.error && <p className="text-sm text-rose-300">Could not read ticket events. Check your RPC connection and retry.</p>}<Button variant="primary" onClick={() => onNavigate('play')}>Choose a ticket</Button></section>;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-5">
      <div><p className="telemetry text-[var(--rare)]">INVENTORY</p><h1 className="mt-1 font-hud text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">{tickets.length} {tickets.length === 1 ? 'planet' : 'planets'}</h1></div>
      {MEGAPLANETS_CONTRACT_ADDRESS && <a className="telemetry text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline" href={`${EXPLORER_ADDRESS_URL}${MEGAPLANETS_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">View contract</a>}
    </header>
    {(stored.invalidKeys.length > 0 || gallery.ignoredCount > 0) && <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">{stored.invalidKeys.length + gallery.ignoredCount} malformed or provenance-incomplete local record(s) were ignored.</div>}
    {indexed.error && <div className="rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">The indexed collection is temporarily unavailable. Eligible ticket previews remain visible, but minted ownership cannot be confirmed.</div>}
    {drawingStates.error && <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">Drawing statuses are temporarily unavailable. Planet ownership and ticket provenance are unaffected.</div>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)]">
      <section aria-label="Planet inventory"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{gallery.previews.map((preview) => { const ticketId = preview.descriptor.input.ticketId.toString(); const revealed = isRevealed(ticketId); return <PlanetInventoryCard key={ticketId} preview={preview} revealed={revealed} drawingStatus={drawingStates.states.get(preview.descriptor.input.drawingId.toString())} selected={ticketId === selectedTicketId} onSelect={() => setSelectedTicketId(ticketId)} mintAction={revealed ? null : mintAction(preview)} />; })}</div>{tickets.length > gallery.previews.length && <Button variant="secondary" size="sm" className="mt-4" onClick={() => setVisiblePreviewCount((count) => count + PREVIEW_PAGE_SIZE)}>Show 12 more ({tickets.length - gallery.previews.length} remaining)</Button>}</section>
      {selected && <aside aria-label="Selected planet detail"><PlanetInventoryDetail preview={selected} revealed={isRevealed(selected.descriptor.input.ticketId.toString())} drawingStatus={drawingStates.states.get(selected.descriptor.input.drawingId.toString())} mintAction={mintAction(selected)} /></aside>}
    </div>
  </div>;
}
