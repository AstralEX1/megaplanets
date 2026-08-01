import { renderPlanetFrame, type PlanetDescriptor } from '@megaplanets/planet-generator';
import { useEffect, useRef } from 'react';

export function PlanetThumbnail({ descriptor }: { descriptor: PlanetDescriptor }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = renderPlanetFrame(descriptor, 0);
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas
      .getContext('2d')
      ?.putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  }, [descriptor]);

  return (
    <canvas
      ref={canvasRef}
      className="aspect-square h-auto w-full bg-[#050610]"
      style={{ imageRendering: 'pixelated' }}
      aria-label={`Deterministic preview for ticket ${descriptor.input.ticketId.toString()}`}
    />
  );
}
