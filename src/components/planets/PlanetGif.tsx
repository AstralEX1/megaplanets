import { serializePlanetInput, type PlanetPreview } from '@megaplanets/planet-generator';
import { useEffect, useState } from 'react';
import { PlanetThumbnail } from './PlanetThumbnail';

type GifState =
  | { status: 'loading'; url: null }
  | { status: 'ready'; url: string }
  | { status: 'error'; url: null };

export function PlanetGif({ preview }: { preview: PlanetPreview }) {
  const [gif, setGif] = useState<GifState>({ status: 'loading', url: null });

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setGif({ status: 'error', url: null });
      return;
    }

    const requestId = `${preview.descriptor.seed}:${preview.descriptor.input.ticketId.toString()}`;
    const worker = new Worker(new URL('../../workers/planetGif.worker.ts', import.meta.url), { type: 'module' });
    let objectUrl: string | null = null;
    setGif({ status: 'loading', url: null });

    worker.onmessage = (event: MessageEvent<{ requestId: string; gif: ArrayBuffer } | { requestId: string; error: string }>) => {
      if (event.data.requestId !== requestId) return;
      if ('error' in event.data) {
        setGif({ status: 'error', url: null });
        return;
      }
      objectUrl = URL.createObjectURL(new Blob([event.data.gif], { type: 'image/gif' }));
      setGif({ status: 'ready', url: objectUrl });
    };
    worker.onerror = () => setGif({ status: 'error', url: null });
    worker.postMessage({ requestId, input: serializePlanetInput(preview.descriptor.input) });

    return () => {
      worker.terminate();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview]);

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
