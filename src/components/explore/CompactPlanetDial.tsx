import { useState } from 'react';
import { clampExpeditionQuantity } from '@/lib/expeditionFlow';

const MIN = 1;
const MAX = 50;
const MARKERS = [1, 10, 25, 50] as const;

/** The visible control follows the expedition console design while the native range owns all input semantics. */
export function CompactPlanetDial({ quantity, onChange }: { quantity: number; onChange: (value: number) => void }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState(String(quantity));
  const progress = ((quantity - MIN) / (MAX - MIN)) * 100;

  const applyCustomValue = () => {
    if (customValue.trim() !== '') {
      const value = Number(customValue);
      if (Number.isFinite(value)) onChange(clampExpeditionQuantity(value));
    }
    setCustomOpen(false);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <span className="telemetry text-[var(--text-secondary)]">Planets to explore</span>
        <div className="flex items-center gap-3">
          {customOpen ? <input autoFocus aria-label="Custom planet count" className="h-9 w-20 rounded-lg border border-[var(--rare)] bg-[var(--surface-raised)] px-2 text-right font-hud text-sm font-bold tabular-nums text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--rare)]" type="number" min={MIN} max={MAX} inputMode="numeric" value={customValue} onChange={(event) => setCustomValue(event.target.value)} onBlur={applyCustomValue} onKeyDown={(event) => { if (event.key === 'Enter') applyCustomValue(); }} /> : <><output className="font-hud text-lg font-bold tabular-nums text-[var(--text-primary)]">{quantity}</output><button type="button" aria-label="Custom quantity" onClick={() => { setCustomValue(String(quantity)); setCustomOpen(true); }} className="rounded-md border border-[var(--border-strong)] px-2 py-1 telemetry font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--rare)] hover:text-[var(--rare)]">Custom</button></>}
        </div>
      </div>
      <div className="relative mt-3 flex h-7 items-center">
        <div className="h-1.5 w-full rounded-full bg-[var(--border)]" />
        <div className="pointer-events-none absolute left-0 h-1.5 rounded-full bg-[var(--rare)]" style={{ width: `${progress}%` }} />
        <input
          className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-5.5 [&::-moz-range-thumb]:w-5.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-[var(--text-primary)] [&::-moz-range-thumb]:bg-[var(--rare)] [&::-webkit-slider-thumb]:h-5.5 [&::-webkit-slider-thumb]:w-5.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-[var(--text-primary)] [&::-webkit-slider-thumb]:bg-[var(--rare)]"
          type="range"
          min={MIN}
          max={MAX}
          value={quantity}
          aria-label="Planets to explore"
          onInput={(event) => onChange(Number(event.currentTarget.value))}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] tracking-[0.08em] text-[var(--text-secondary)]">
        {MARKERS.map((marker) => <span key={marker}>{marker}</span>)}
      </div>
    </div>
  );
}
