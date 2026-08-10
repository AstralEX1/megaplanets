import { useRef } from 'react';

const MIN = 1;
const MAX = 100;

function valueFromPoint(clientX: number, clientY: number, rect: DOMRect) {
  const x = Math.min(rect.width, Math.max(0, clientX - rect.left));
  const y = Math.min(rect.height, Math.max(0, clientY - rect.top));
  const centerX = rect.width / 2;
  const centerY = rect.height - 10;
  const angle = Math.atan2(y - centerY, x - centerX);
  const bounded = Math.min(Math.PI, Math.max(0, Math.PI + angle));
  return Math.round(MIN + (bounded / Math.PI) * (MAX - MIN));
}

/** Compact SVG dial. The hidden range keeps the complete keyboard interaction available. */
export function CompactPlanetDial({ quantity, onChange }: { quantity: number; onChange: (value: number) => void }) {
  const dialRef = useRef<SVGSVGElement | null>(null);
  const progress = (quantity - MIN) / (MAX - MIN);
  const angle = Math.PI * (1 - progress);
  const x = 180 + 132 * Math.cos(angle);
  const y = 140 - 132 * Math.sin(angle);

  const updateFromPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (rect) onChange(valueFromPoint(event.clientX, event.clientY, rect));
  };

  return (
    <div className="relative mx-auto h-[142px] w-full max-w-[360px]">
      <svg
        ref={dialRef}
        viewBox="0 0 360 150"
        className="h-full w-full touch-none"
        role="presentation"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); updateFromPointer(event); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateFromPointer(event); }}
      >
        <path d="M 48 140 A 132 132 0 0 1 312 140" fill="none" stroke="var(--border)" strokeWidth="4" strokeLinecap="round" />
        <path d="M 48 140 A 132 132 0 0 1 312 140" fill="none" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" pathLength="1" strokeDasharray={`${progress} 1`} />
        {[10, 50, 100].map((point) => {
          const markerAngle = Math.PI * (1 - (point - MIN) / (MAX - MIN));
          return <circle key={point} cx={180 + 132 * Math.cos(markerAngle)} cy={140 - 132 * Math.sin(markerAngle)} r="3" fill="var(--surface-raised)" stroke="var(--border-strong)" />;
        })}
        <circle cx={x} cy={y} r="8" fill="var(--primary)" stroke="var(--primary-foreground)" strokeWidth="3" />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
        <output className="block font-hud text-4xl font-semibold tabular-nums text-[var(--text-primary)]">{quantity}</output>
        <span className="mt-0.5 block text-xs font-medium tracking-[0.14em] text-[var(--text-secondary)]">{quantity === 1 ? 'PLANET' : 'PLANETS'}</span>
      </div>
      <input
        className="sr-only"
        type="range"
        min={MIN}
        max={MAX}
        value={quantity}
        aria-label="Planet quantity"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
