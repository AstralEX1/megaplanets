import { PixelIcon } from './PixelIcon';

export function NumberInput({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (next: number) => void }) {
  const update = (next: number) => onChange(Math.min(max, Math.max(min, Math.trunc(next))));
  return (
    <div className="flex items-center border border-[var(--border)] bg-[var(--surface-raised)]">
      <button type="button" aria-label="Decrease quantity" onClick={() => update(value - 1)} disabled={value <= min} className="grid h-10 w-10 place-items-center border-r border-[var(--border)] text-[var(--primary)] disabled:text-[var(--text-muted)]"><PixelIcon name="subtract" className="h-4 w-4" /></button>
      <input aria-label="Custom expedition quantity" type="number" min={min} max={max} value={value} onChange={(event) => update(Number(event.target.value))} className="font-hud h-10 w-14 bg-transparent text-center text-sm font-semibold text-[var(--text)] outline-none" />
      <button type="button" aria-label="Increase quantity" onClick={() => update(value + 1)} disabled={value >= max} className="grid h-10 w-10 place-items-center border-l border-[var(--border)] text-[var(--primary)] disabled:text-[var(--text-muted)]"><PixelIcon name="add" className="h-4 w-4" /></button>
    </div>
  );
}
