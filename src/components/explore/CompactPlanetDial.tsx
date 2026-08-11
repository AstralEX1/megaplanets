import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampExpeditionQuantity } from '@/lib/expeditionFlow';

const MIN = 1;
const MAX = 50;
const MARKERS = [1, 10, 25, 50] as const;

/** Quantity is controlled by Play; this component exposes an explicit, keyboard-accessible slider thumb. */
export function CompactPlanetDial({ quantity, onChange }: { quantity: number; onChange: (value: number) => void }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);
  const dragPointerRef = useRef<number | null>(null);
  const progress = ((quantity - MIN) / (MAX - MIN)) * 100;

  useEffect(() => {
    if (customOpen) customInputRef.current?.focus();
  }, [customOpen]);

  const applyCustomValue = () => {
    if (customValue.trim() !== '') onChange(clampExpeditionQuantity(Number(customValue)));
    setCustomOpen(false);
  };

  const updateFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onChange(Math.round(MIN + ratio * (MAX - MIN)));
  };

  const updateFromKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const values: Record<string, number> = {
      ArrowLeft: quantity - 1,
      ArrowDown: quantity - 1,
      ArrowRight: quantity + 1,
      ArrowUp: quantity + 1,
      PageDown: quantity - 5,
      PageUp: quantity + 5,
      Home: MIN,
      End: MAX,
    };
    const next = values[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange(clampExpeditionQuantity(next));
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="telemetry text-[var(--text-secondary)]">Planets to explore</span>
        <div className="flex items-center gap-3">
          {customOpen ? <input ref={customInputRef} aria-label="Custom planet count" placeholder={String(quantity)} className="h-10 w-20 rounded-lg border border-[var(--rare)] bg-[var(--surface-raised)] px-2 text-right font-hud text-sm font-bold tabular-nums text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:ring-2 focus:ring-[var(--rare)]" type="number" min={MIN} max={MAX} inputMode="numeric" value={customValue} onChange={(event) => setCustomValue(event.target.value)} onBlur={applyCustomValue} onKeyDown={(event) => { if (event.key === 'Enter') applyCustomValue(); }} /> : <><output className="font-hud text-lg font-bold tabular-nums text-[var(--text-primary)]">{quantity}</output><button type="button" aria-label="Custom quantity" onClick={() => { setCustomValue(''); setCustomOpen(true); }} className="min-h-10 min-w-10 rounded-md border border-[var(--border-strong)] px-2 py-1 telemetry font-bold text-[var(--text-primary)] transition-[scale,border-color,color] duration-150 ease-out active:scale-[0.96] hover:border-[var(--rare)] hover:text-[var(--rare)]">Custom</button></>}
        </div>
      </div>
      <div role="slider" aria-label="Planets to explore" aria-valuemin={MIN} aria-valuemax={MAX} aria-valuenow={quantity} aria-valuetext={`${quantity} planets`} tabIndex={0} className="relative mt-3 h-8 touch-none select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--rare)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]" onPointerDown={(event) => { dragPointerRef.current = event.pointerId; try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Synthetic pointer events do not always have an active pointer to capture. */ } updateFromPointer(event); }} onPointerMove={(event) => { if (dragPointerRef.current === event.pointerId) updateFromPointer(event); }} onPointerUp={(event) => { if (dragPointerRef.current === event.pointerId) { dragPointerRef.current = null; try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* The pointer can already be released by the browser. */ } } }} onPointerCancel={(event) => { if (dragPointerRef.current === event.pointerId) { dragPointerRef.current = null; try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* The pointer can already be released by the browser. */ } } }} onKeyDown={updateFromKey}>
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--border)]" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--rare)]" style={{ width: `${progress}%` }} />
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 z-10 grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-[var(--text-primary)] bg-[var(--rare)] shadow-[0_0_0_4px_var(--background)]" style={{ left: `${progress}%` }} />
      </div>
      <div className="-mt-1 flex items-center justify-between text-sm font-bold tracking-[0.08em] text-[var(--text-secondary)]">
        {MARKERS.map((marker) => <span key={marker}>{marker}</span>)}
      </div>
    </div>
  );
}
