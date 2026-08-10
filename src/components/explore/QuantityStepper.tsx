export function QuantityStepper({ quantity, onChange }: { quantity: number; onChange: (value: number) => void }) {
  const step = quantity < 10 ? 1 : quantity < 50 ? 5 : 10;
  return <div className="mx-auto flex h-12 max-w-[360px] items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
    <button type="button" aria-label="Decrease planet quantity" disabled={quantity <= 1} onClick={() => onChange(Math.max(1, quantity - step))} className="grid h-12 min-w-12 place-items-center border-r border-[var(--border)] text-xl text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)]">−</button>
    <output className="flex-1 text-center font-hud text-lg font-semibold tabular-nums text-[var(--text-primary)]">{quantity}</output>
    <button type="button" aria-label="Increase planet quantity" disabled={quantity >= 100} onClick={() => onChange(Math.min(100, quantity + step))} className="grid h-12 min-w-12 place-items-center border-l border-[var(--border)] text-xl text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:text-[var(--text-disabled)]">+</button>
  </div>;
}
