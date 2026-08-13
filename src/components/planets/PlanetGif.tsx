import { serializePlanetInput, type PlanetPreview } from '@megaplanets/planet-generator';
import { useEffect, useState } from 'react';
import { PlanetThumbnail } from './PlanetThumbnail';

type GifState =
  | { status: 'loading'; url: null }
  | { status: 'ready'; url: string }
  | { status: 'error'; url: null };

export function PlanetGif({
  preview,
  deferGeneration = false,
}: {
  preview: PlanetPreview;
  deferGeneration?: boolean;
}) {
  const [gif, setGif] = useState<GifState>({ status: 'loading', url: null });
  const [generationStarted, setGenerationStarted] = useState(!deferGeneration);

  useEffect(() => {
    const requestId = `${preview.descriptor.seed}:${preview.descriptor.input.ticketId.toString()}`;
    let worker: Worker | null = null;
    let objectUrl: string | null = null;
    let active = true;
    if (deferGeneration) setGenerationStarted(false);
    setGif({ status: 'loading', url: null });

    const startGeneration = () => {
      if (!active) return;
      setGenerationStarted(true);
      if (typeof Worker === 'undefined') {
        setGif({ status: 'error', url: null });
        return;
      }

      worker = new Worker(new URL('../../workers/planetGif.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ requestId: string; gif: ArrayBuffer } | { requestId: string; error: string }>) => {
        if (!active || event.data.requestId !== requestId) return;
        if ('error' in event.data) {
          setGif({ status: 'error', url: null });
          return;
        }
        objectUrl = URL.createObjectURL(new Blob([event.data.gif], { type: 'image/gif' }));
        setGif({ status: 'ready', url: objectUrl });
      };
      worker.onerror = () => {
        if (active) setGif({ status: 'error', url: null });
      };
      worker.postMessage({ requestId, input: serializePlanetInput(preview.descriptor.input) });
    };

    const timer = deferGeneration ? window.setTimeout(startGeneration, 450) : null;
    if (!deferGeneration) startGeneration();

    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
      worker?.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [deferGeneration, preview]);

  if (deferGeneration && !generationStarted) {
    return (
      <div
        className="relative aspect-square w-full bg-[#050610]"
        role="img"
        aria-label={`Preparing animated planet ${preview.descriptor.traits.name}`}
      />
    );
  }

  if (gif.status === 'ready') {
    return (
      <img
        src={gif.url}
        alt={`Animated planet ${preview.descriptor.traits.name}`}
        className="aspect-square w-full"
        style={{ imageRendering: 'pixelated' }}
      />
    );
  }

  return (
    <div className="relative">
      <PlanetThumbnail descriptor={preview.visual} />
      {gif.status === 'loading' ? <span className="sr-only">Encoding animated planet</span> : null}
    </div>
  );
}
