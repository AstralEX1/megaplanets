export type QuantityPreset = 10 | 50 | 100 | 'custom' | null;

export function QuantityPresets({ quantity, selectedPreset, onSelect, onQuantityChange }: { quantity: number; selectedPreset: QuantityPreset; onSelect: (preset: Exclude<QuantityPreset, null>) => void; onQuantityChange: (quantity: number) => void }) {
  return <fieldset className="flex items-center justify-center gap-2" aria-label="Quantity presets">
    {([10, 50, 100] as const).map((preset) => <button key={preset} type="button" aria-label={`${preset} planets`} aria-pressed={selectedPreset === preset} onClick={() => onSelect(preset)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${selectedPreset === preset ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]' : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'}`}>{preset}</button>)}
    <button type="button" aria-label="Custom quantity" aria-pressed={selectedPreset === 'custom'} onClick={() => onSelect('custom')} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${selectedPreset === 'custom' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'}`}>CUSTOM</button>
    {selectedPreset === 'custom' && <input type="number" min="1" max="100" value={quantity} aria-label="Custom planet quantity" onChange={(event) => onQuantityChange(Number(event.target.value))} className="h-11 w-16 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-center text-sm text-[var(--text-primary)]" />}
  </fieldset>;
}
