import {
  derivePlanetPreview,
  type PlanetPreview,
  serializePlanetInput,
} from '@megaplanets/planet-generator';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { CopyButton } from '@/components/common/CopyButton';
import type { NavKey } from '@/components/layout/Nav';
import { PlanetThumbnail } from '@/components/planets/PlanetThumbnail';
import { COPY } from '@/config/copy';
import { PLANET_SEASON } from '@/config/planetSeason';
import {
  PURCHASED_TICKETS_UPDATED_EVENT,
  readPersistedPurchasedTickets,
} from '@/lib/purchaseReceipt';

type GifState =
  | { status: 'idle' | 'loading'; url: null; error: null }
  | { status: 'ready'; url: string; error: null }
  | { status: 'error'; url: null; error: string };

export function Planets({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const { address, isConnected } = useAccount();
  const [, setStorageRevision] = useState(0);
  useEffect(() => {
    if (!address) return;
    const onTicketsUpdated = (event: Event) => {
      const account = (event as CustomEvent<{ account?: string }>).detail?.account;
      if (account === address.toLowerCase()) setStorageRevision((revision) => revision + 1);
    };
    window.addEventListener(PURCHASED_TICKETS_UPDATED_EVENT, onTicketsUpdated);
    return () => window.removeEventListener(PURCHASED_TICKETS_UPDATED_EVENT, onTicketsUpdated);
  }, [address]);
  const stored = address
    ? readPersistedPurchasedTickets(address)
    : { tickets: [], invalidKeys: [] };
  const gallery = useMemo(() => {
    const previews: PlanetPreview[] = [];
    let ignoredCount = 0;
    if (!PLANET_SEASON) return { previews, ignoredCount };
    for (const ticket of stored.tickets) {
      if (!ticket.originTxHash || ticket.logIndex === null) {
        ignoredCount += 1;
        continue;
      }
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
  }, [stored]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [gif, setGif] = useState<GifState>({ status: 'idle', url: null, error: null });

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

  useEffect(() => {
    if (!selected) {
      setGif({ status: 'idle', url: null, error: null });
      return;
    }
    const requestId = `${selected.descriptor.seed}:${retryNonce}`;
    const worker = new Worker(new URL('../workers/planetGif.worker.ts', import.meta.url), {
      type: 'module',
    });
    let objectUrl: string | null = null;
    setGif({ status: 'loading', url: null, error: null });
    worker.onmessage = (
      event: MessageEvent<
        { requestId: string; gif: ArrayBuffer } | { requestId: string; error: string }
      >,
    ) => {
      if (event.data.requestId !== requestId) return;
      if ('error' in event.data) {
        setGif({ status: 'error', url: null, error: event.data.error });
        return;
      }
      objectUrl = URL.createObjectURL(new Blob([event.data.gif], { type: 'image/gif' }));
      setGif({ status: 'ready', url: objectUrl, error: null });
    };
    worker.onerror = (event) =>
      setGif({ status: 'error', url: null, error: event.message || 'GIF worker failed.' });
    worker.postMessage({
      requestId,
      input: serializePlanetInput(selected.descriptor.input),
    });
    return () => {
      worker.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected, retryNonce]);

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
  if (gallery.previews.length === 0) {
    return (
      <section className="card-pad mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">No planets discovered yet</h1>
        <p className="text-sm text-zinc-400">
          Buy a ticket through MegaPlanets in this browser to create its deterministic preview.
        </p>
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
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your Planets</h1>
      </header>
      {(stored.invalidKeys.length > 0 || gallery.ignoredCount > 0) && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">
          {stored.invalidKeys.length + gallery.ignoredCount} malformed or provenance-incomplete
          local record(s) were ignored.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.1fr)]">
        <section className="card-pad">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {gallery.previews.map((preview) => {
              const ticketId = preview.descriptor.input.ticketId.toString();
              return (
                <button
                  key={ticketId}
                  type="button"
                  onClick={() => setSelectedTicketId(ticketId)}
                  className={`overflow-hidden rounded-lg border text-left ${ticketId === selectedTicketId ? 'border-brand-primary-400 bg-brand-primary-950/50' : 'border-[#3c4475] bg-[#0a0d24]'}`}
                >
                  <PlanetThumbnail descriptor={preview.visual} />
                  <span className="flex justify-between px-2 py-2 text-xs">
                    <span className="font-mono">#{ticketId}</span>
                    <span className="text-zinc-400">{preview.descriptor.traits.rarity}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        {selected && (
          <section className="card-pad space-y-4">
            <div className="overflow-hidden rounded-lg border border-[#3c4475] bg-[#050610]">
              {gif.status === 'ready' ? (
                <img
                  src={gif.url}
                  alt={`Animated ${selected.descriptor.traits.name}`}
                  className="aspect-square w-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <PlanetThumbnail descriptor={selected.visual} />
              )}
            </div>
            {gif.status === 'error' && (
              <div className="rounded-lg border border-rose-900 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
                <p>{gif.error}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => setRetryNonce((value) => value + 1)}
                >
                  Retry GIF
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">{selected.descriptor.traits.name}</h2>
                <p className="text-sm text-zinc-400">
                  Ticket #{selected.descriptor.input.ticketId.toString()} · Drawing #
                  {selected.descriptor.input.drawingId.toString()}
                </p>
              </div>
              {gif.status === 'ready' && (
                <a
                  href={gif.url}
                  download={`megaplanet-${selected.descriptor.input.ticketId.toString()}.gif`}
                  className="pixel-frame bg-brand-primary-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  Download GIF
                </a>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
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
            </dl>
            <div className="space-y-2 border-t border-[#3c4475] pt-3 text-xs">
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
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
