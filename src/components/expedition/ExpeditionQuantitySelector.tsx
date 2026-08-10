import type { PointerEvent } from 'react';

const MARKERS = [1, 5, 10, 25, 50, 100] as const;

function stepFor(quantity: number): number {
  if (quantity < 10) return 1;
  if (quantity < 50) return 5;
  return 10;
}

function pointFor(quantity: number) {
  const ratio = (quantity - 1) / 99;
  const angle = Math.PI + ratio * Math.PI;
  return { x: 50 + Math.cos(angle) * 41, y: 52 + Math.sin(angle) * 41 };
}

/** Pointer-accessible half dial. The hidden range preserves keyboard semantics without a second visible slider. */
export function ExpeditionQuantitySelector({ quantity, onChange }: { quantity: number; onChange: (quantity: number) => void }) {
  const point = pointFor(quantity);
  const update = (next: number) => onChange(Math.min(100, Math.max(1, Math.round(next))));
  const selectAtPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 100;
    const y = ((event.clientY - box.top) / box.height) * 58;
    let angle = Math.atan2(y - 52, x - 50);
    if (angle < 0) angle += Math.PI * 2;
    angle = Math.min(Math.PI * 2, Math.max(Math.PI, angle));
    update(1 + ((angle - Math.PI) / Math.PI) * 99);
  };

  return <div className="mx-auto max-w-sm select-none">
    <svg viewBox="0 0 100 58" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); selectAtPointer(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) selectAtPointer(event); }} className="block w-full cursor-crosshair overflow-visible" aria-hidden="true">
      <path d="M 9 52 A 41 41 0 0 1 91 52" fill="none" stroke="var(--border)" strokeWidth="1.4" />
      <path d={`M 9 52 A 41 41 0 0 1 ${point.x} ${point.y}`} fill="none" stroke="var(--primary)" strokeLinecap="square" strokeWidth="1.8" />
      {MARKERS.map((marker) => { const markerPoint = pointFor(marker); return <g key={marker}><circle cx={markerPoint.x} cy={markerPoint.y} r="1.8" fill={marker <= quantity ? 'var(--primary)' : 'var(--border)'} /><text x={markerPoint.x} y={markerPoint.y - 4} textAnchor="middle" fill="var(--text-muted)" fontSize="3.4">{marker}</text></g>; })}
      <rect x={point.x - 3} y={point.y - 3} width="6" height="6" fill="var(--surface)" stroke="var(--primary)" strokeWidth="1.4" transform={`rotate(45 ${point.x} ${point.y})`} />
    </svg>
    <div className="-mt-2 text-center"><p className="font-hud text-6xl font-semibold tabular-nums text-[var(--text)]">{quantity}</p><p className="telemetry mt-1 text-[var(--text-muted)]">planet count · step {stepFor(quantity)}</p></div>
    <input aria-label="Select expedition planet count" className="sr-only" type="range" min="1" max="100" step={stepFor(quantity)} value={quantity} onChange={(event) => update(Number(event.target.value))} />
  </div>;
}
