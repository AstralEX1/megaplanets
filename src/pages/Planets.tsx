import {
  derivePlanet,
  serializePlanetInput,
  type PlanetDescriptor,
} from '@megaplanets/planet-generator';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { CopyButton } from '@/components/common/CopyButton';
import type { NavKey } from '@/components/layout/Nav';
import { PlanetThumbnail } from '@/components/planets/PlanetThumbnail';
import { COPY } from '@/config/copy';
import { readPersistedPurchasedTickets } from '@/lib/purchaseReceipt';

type GifState =
  | { status: 'idle' | 'loading'; url: null; error: null }
  | { status: 'ready'; url: string; error: null }
  | { status: 'error'; url: null; error: string };

function createDescriptor(ticket: {
  ticketId: bigint;
  drawingId: bigint;
  normals: readonly number[];
  bonusBall: number;
}): PlanetDescriptor {
  return derivePlanet(ticket);
}

export function Planets({ onNavigate }: { onNavigate: (key: NavKey) => void }) {
  const { address, isConnected } = useAccount();
  const stored = useMemo(
    () => (address ? readPersistedPurchasedTickets(address) : { tickets: [], invalidKeys: [] }),
    [address],
  );
  const gallery = useMemo(() => {
    const descriptors: PlanetDescriptor[] = [];
    let invalidCount = 0;
    for (const ticket of stored.tickets) {
      try {
        descriptors.push(createDescriptor(ticket));
      } catch {
        invalidCount += 1;
      }
    }
    return { descriptors, invalidCount };
  }, [stored]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [gif, setGif] = useState<GifState>({ status: 'idle', url: null, error: null });

  useEffect(() => {
    const stillExists = gallery.descriptors.some(
      (descriptor) => descriptor.input.ticketId.toString() === selectedTicketId,
    );
    if (!stillExists) {
      setSelectedTicketId(gallery.descriptors[0]?.input.ticketId.toString() ?? null);
    }
  }, [gallery.descriptors, selectedTicketId]);

  const selected = gallery.descriptors.find(
    (descriptor) => descriptor.input.ticketId.toString() === selectedTicketId,
  );

  useEffect(() => {
    if (!selected) {
      setGif({ status: 'idle', url: null, error: null });
      return;
    }
    const requestId = `${selected.seed}:${retryNonce}`;
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
    worker.onerror = (event) => {
      setGif({ status: 'error', url: null, error: event.message || 'GIF worker failed.' });
    };
    worker.postMessage({ requestId, input: serializePlanetInput(selected.input) });
    return () => {
      worker.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected, retryNonce]);

  if (!isConnected || !address) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {COPY.connectToViewPlanets}
      </div>
    );
  }

  if (gallery.descriptors.length === 0) {
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
          Generator v1
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your Planets</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Deterministic previews from confirmed MegaPlanets tickets saved in this browser.
        </p>
      </header>

      {(stored.invalidKeys.length > 0 || gallery.invalidCount > 0) && (
        <div className="rounded-lg border border-amber-800 bg-amber-950/50 px-4 py-3 text-sm text-amber-200">
          {stored.invalidKeys.length + gallery.invalidCount} malformed local ticket record(s) were
          ignored.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.1fr)]">
        <section className="card-pad">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Confirmed tickets
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {gallery.descriptors.map((descriptor) => {
              const ticketId = descriptor.input.ticketId.toString();
              const active = ticketId === selectedTicketId;
              return (
                <button
                  type="button"
                  key={ticketId}
                  onClick={() => setSelectedTicketId(ticketId)}
                  className={
                    'overflow-hidden rounded-lg border text-left transition-colors ' +
                    (active
                      ? 'border-brand-primary-400 bg-brand-primary-950/50'
                      : 'border-[#3c4475] bg-[#0a0d24] hover:border-[#6974ad]')
                  }
                >
                  <PlanetThumbnail descriptor={descriptor} />
                  <span className="flex items-center justify-between gap-2 px-2 py-2 text-xs">
                    <span className="font-mono">#{ticketId}</span>
                    <span className="text-zinc-400">{descriptor.rarity}</span>
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
                  alt={`Animated Planet for ticket ${selected.input.ticketId.toString()}`}
                  className="aspect-square w-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="relative">
                  <PlanetThumbnail descriptor={selected} />
                  {gif.status === 'loading' && (
                    <div className="absolute inset-x-0 bottom-0 bg-[#050610]/85 px-3 py-2 text-center text-xs text-zinc-300">
                      Encoding 48 GIF frames…
                    </div>
                  )}
                </div>
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
                <h2 className="text-xl font-semibold">
                  Planet #{selected.input.ticketId.toString()}
                </h2>
                <p className="text-sm text-zinc-400">
                  Drawing #{selected.input.drawingId.toString()}
                </p>
              </div>
              {gif.status === 'ready' && (
                <a
                  href={gif.url}
                  download={`megaplanet-${selected.input.ticketId.toString()}-v1.gif`}
                  className="pixel-frame bg-brand-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary-500"
                >
                  Download GIF
                </a>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-zinc-500">Rarity</dt>
                <dd className="font-semibold">{selected.rarity}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Daily points</dt>
                <dd className="font-mono font-semibold">{selected.dailyPoints.toString()}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Palette</dt>
                <dd>{selected.traits.paletteType}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Terrain</dt>
                <dd>{selected.traits.noiseMode}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Clouds</dt>
                <dd>{selected.traits.hasClouds ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Satellites</dt>
                <dd>
                  {selected.traits.satellites.length}
                  {selected.traits.hasRing ? ' · ring' : ''}
                </dd>
              </div>
            </dl>

            <div className="space-y-2 border-t border-[#3c4475] pt-3 text-xs">
              <p className="text-zinc-500">Numbers</p>
              <p className="font-mono">
                {selected.input.normals.join(' · ')} + {selected.input.bonusBall}
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-16 shrink-0 text-zinc-500">Seed</span>
                <code className="truncate">{selected.seed}</code>
                <CopyButton value={selected.seed} label="Copy seed" />
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-16 shrink-0 text-zinc-500">Traits</span>
                <code className="truncate">{selected.traitsHash}</code>
                <CopyButton value={selected.traitsHash} label="Copy traits hash" />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
