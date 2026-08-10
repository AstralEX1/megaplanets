import {
  derivePlanetPreview,
  type PlanetPreview,
} from '@megaplanets/planet-generator';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { CopyButton } from '@/components/common/CopyButton';
import type { NavKey } from '@/components/layout/Nav';
import { PlanetThumbnail } from '@/components/planets/PlanetThumbnail';
import { MintPlanetBatchButton } from '@/components/planets/MintPlanetBatchButton';
import { MintPlanetButton } from '@/components/planets/MintPlanetButton';
import { COPY } from '@/config/copy';
import { PLANET_SEASON } from '@/config/planetSeason';
import { EXPLORER_ADDRESS_URL, MEGAPLANETS_CONTRACT_ADDRESS } from '@/config/contracts';
import { useEligiblePlanetTickets } from '@/hooks/useEligiblePlanetTickets';
import { useIndexedPlanets } from '@/hooks/useIndexedPlanets';
import { mergePlanetTickets } from '@/lib/planetTickets';
import {
  PURCHASED_TICKETS_UPDATED_EVENT,
  readPersistedPurchasedTickets,
} from '@/lib/purchaseReceipt';

const INITIAL_PREVIEW_COUNT = 12;
const PREVIEW_PAGE_SIZE = 12;

export function Planets({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const { address, isConnected } = useAccount();
  const [stored, setStored] = useState(() => ({
    tickets: [] as ReturnType<typeof readPersistedPurchasedTickets>['tickets'],
    invalidKeys: [] as readonly string[],
  }));
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
  const eligibleTickets = useMemo(
    () =>
      mergePlanetTickets(
        stored.tickets.filter(
          (ticket): ticket is typeof ticket & { originTxHash: NonNullable<typeof ticket.originTxHash>; logIndex: NonNullable<typeof ticket.logIndex> } =>
            ticket.originTxHash !== null && ticket.logIndex !== null,
        ),
        onChain.tickets,
      ),
    [stored.tickets, onChain.tickets],
  );
  const indexedTickets = useMemo(
    () =>
      indexed.planets.flatMap((planet) => {
        if (!planet.ticket || planet.ticketId === null) return [];
        return [{
          ticketId: BigInt(planet.ticketId),
          drawingId: BigInt(planet.ticket.drawingId),
          normals: planet.ticket.normals,
          bonusBall: planet.ticket.bonusBall,
          originTxHash: planet.ticket.originTxHash,
          logIndex: 0n,
        }];
      }),
    [indexed.planets],
  );
  const tickets = useMemo(
    () => mergePlanetTickets(eligibleTickets, indexedTickets),
    [eligibleTickets, indexedTickets],
  );
  const indexedTokenIds = useMemo(
    () => new Set(indexed.planets.map((planet) => planet.tokenId)),
    [indexed.planets],
  );
  const [visiblePreviewCount, setVisiblePreviewCount] = useState(INITIAL_PREVIEW_COUNT);
  const gallery = useMemo(() => {
    const previews: PlanetPreview[] = [];
    let ignoredCount = 0;
    if (!PLANET_SEASON) return { previews, ignoredCount };
    for (const ticket of tickets.slice(0, visiblePreviewCount)) {
      try {
        previews.push(
          derivePlanetPreview(
            {
              seasonId: PLANET_SEASON.seasonId,
              ticketId: ticket.ticketId,
              drawingId: ticket.drawingId,
              normals: ticket.normals,
              bonusBall: ticket.bonusBall,
              originTxHash: ticket.originTxHash,
            },
            PLANET_SEASON,
          ),
        );
      } catch {
        ignoredCount += 1;
      }
    }
    return { previews, ignoredCount };
  }, [tickets, visiblePreviewCount]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [revealedTicketIds, setRevealedTicketIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    if (
      !gallery.previews.some(
        ({ descriptor }) => descriptor.input.ticketId.toString() === selectedTicketId,
      )
    ) {
      setSelectedTicketId(gallery.previews[0]?.descriptor.input.ticketId.toString() ?? null);
    }
  }, [gallery.previews, selectedTicketId]);

  const selected = gallery.previews.find(
    ({ descriptor }) => descriptor.input.ticketId.toString() === selectedTicketId,
  );
  const selectedTicket = tickets.find((ticket) => ticket.ticketId.toString() === selectedTicketId);
  const visiblePreviews = gallery.previews;
  const isRevealed = (ticketId: string) => indexedTokenIds.has(ticketId) || revealedTicketIds.has(ticketId);
  const selectedIsRevealed = selected ? isRevealed(selected.descriptor.input.ticketId.toString()) : false;
  const unrevealed = gallery.previews.filter((preview) => !isRevealed(preview.descriptor.input.ticketId.toString()));
  const markRevealed = (ticketIds: readonly bigint[]) => {
    setRevealedTicketIds((current) => new Set([...current, ...ticketIds.map(String)]));
  };

  if (!isConnected || !address) {
    return (
      <div className="rounded-lg border border-amber-900 bg-amber-950 px-4 py-3 text-sm text-amber-100">
        {COPY.connectToViewPlanets}
      </div>
    );
  }
  if (!PLANET_SEASON) {
    return (
      <div className="rounded-lg border border-amber-900 bg-amber-950 px-4 py-3 text-sm text-amber-100">
        Planet generation is unavailable until the deployment Season ID is configured.
      </div>
    );
  }
  if ((onChain.isLoading || indexed.isLoading) && gallery.previews.length === 0) {
    return (
      <section className="card-pad mx-auto max-w-2xl space-y-3 text-center">
        <h1 className="text-2xl font-semibold">Discovering your Planets</h1>
        <p className="text-sm text-zinc-400">Reading confirmed MegaPlanets ticket events from Base Sepolia.</p>
      </section>
    );
  }
  if (gallery.previews.length === 0) {
    return (
      <section className="card-pad mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">No planets discovered yet</h1>
        <p className="text-sm text-zinc-400">
          No eligible MegaPlanets ticket was found for this wallet on Base Sepolia.
        </p>
        {onChain.error && (
          <p className="text-sm text-rose-300">Could not read ticket events. Check your RPC connection and retry.</p>
        )}
        <Button variant="primary" onClick={() => onNavigate('play')}>
          Choose a ticket
        </Button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-400">
          Planet generator
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">My planets</h1>
        {MEGAPLANETS_CONTRACT_ADDRESS && (
          <a className="mt-2 inline-block text-xs text-brand-primary-300 underline" href={`${EXPLORER_ADDRESS_URL}${MEGAPLANETS_CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
            View deployed MegaPlanets contract
          </a>
        )}
      </header>
      {(stored.invalidKeys.length > 0 || gallery.ignoredCount > 0) && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">
          {stored.invalidKeys.length + gallery.ignoredCount} malformed or provenance-incomplete
          local record(s) were ignored.
        </div>
      )}
      {indexed.error && (
        <div className="rounded-lg border border-rose-900 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          The indexed collection is temporarily unavailable. Eligible ticket previews remain visible, but minted ownership cannot be confirmed.
        </div>
      )}
      {unrevealed.length > 1 && (
        <section className="card-pad flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{unrevealed.length} planets ready to reveal</h2>
            <p className="mt-1 text-xs text-zinc-400">Reveal them in one Base Sepolia transaction.</p>
          </div>
          <MintPlanetBatchButton
            planets={unrevealed.map((preview) => ({
              preview,
              logIndex: tickets.find((ticket) => ticket.ticketId === preview.descriptor.input.ticketId)
                ?.logIndex,
            }))}
            onMinted={markRevealed}
          />
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.1fr)]">
        <section className="card-pad">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {visiblePreviews.map((preview) => {
              const ticketId = preview.descriptor.input.ticketId.toString();
              const revealed = isRevealed(ticketId);
              return (
                <button
                  key={ticketId}
                  type="button"
                  onClick={() => setSelectedTicketId(ticketId)}
                  className={`overflow-hidden rounded-lg border text-left ${ticketId === selectedTicketId ? 'border-brand-primary-400 bg-brand-primary-950/50' : 'border-[#3c4475] bg-[#0a0d24]'}`}
                >
                  {revealed ? (
                    <PlanetThumbnail descriptor={preview.visual} />
                  ) : (
                    <div className="grid aspect-square place-items-center bg-black text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Signal hidden
                    </div>
                  )}
                  <span className="flex justify-between px-2 py-2 text-xs">
                    <span>{revealed ? `${preview.descriptor.traits.minerals} minerals/day` : '??? minerals/day'}</span>
                    <span className="text-zinc-400">
                      {indexedTokenIds.has(ticketId) ? 'Claimed' : 'Ends with drawing'}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {tickets.length > visiblePreviews.length && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setVisiblePreviewCount((count) => count + PREVIEW_PAGE_SIZE)}
            >
              Show 12 more ({tickets.length - visiblePreviews.length} remaining)
            </Button>
          )}
        </section>
        {selected && (
          <section className="card-pad space-y-4">
            <div className="overflow-hidden rounded-lg border border-[#3c4475] bg-[#050610]">
              {!selectedIsRevealed ? (
                <div className="grid aspect-square place-items-center bg-black text-xs uppercase tracking-[0.2em] text-zinc-600">
                  Planet signal hidden
                </div>
              ) : (
                <PlanetThumbnail descriptor={selected.visual} />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedIsRevealed ? selected.descriptor.traits.name : 'Unrevealed planet'}
                </h2>
                <p className="text-sm text-zinc-400">
                  Ticket #{selected.descriptor.input.ticketId.toString()} · Drawing #
                  {selected.descriptor.input.drawingId.toString()}
                </p>
              </div>
            </div>
            {selectedIsRevealed && <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Type</dt>
                <dd>{selected.descriptor.traits.type}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Rarity</dt>
                <dd>{selected.descriptor.traits.rarity}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Minerals</dt>
                <dd>{selected.descriptor.traits.minerals}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Satellites</dt>
                <dd>
                  {selected.descriptor.traits.satelliteCount}
                  {selected.descriptor.traits.hasRing ? ' · ring' : ''}
                </dd>
              </div>
            </dl>}
            {indexedTokenIds.has(selected.descriptor.input.ticketId.toString()) ? (
              <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
                Ownership confirmed by the Stage 2 Planet index.
              </div>
            ) : (
              <MintPlanetButton
                preview={selected}
                logIndex={selectedTicket?.logIndex}
                onMinted={(ticketId) => markRevealed([ticketId])}
              />
            )}
            {selectedIsRevealed && <div className="space-y-2 border-t border-[#3c4475] pt-3 text-xs">
              <p className="font-mono">
                {selected.descriptor.input.normals.join(' · ')} +{' '}
                {selected.descriptor.input.bonusBall}
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-16 text-zinc-500">Seed</span>
                <code className="truncate">{selected.descriptor.seed}</code>
                <CopyButton value={selected.descriptor.seed} label="Copy seed" />
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-16 text-zinc-500">Traits</span>
                <code className="truncate">{selected.descriptor.traitsHash}</code>
                <CopyButton value={selected.descriptor.traitsHash} label="Copy traits hash" />
              </div>
            </div>}
          </section>
        )}
      </div>
    </div>
  );
}
