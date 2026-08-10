import { UsdcAmount } from '@/components/common/UsdcAmount';

export function ExploreButton({ quantity, total, disabled, onClick }: { quantity: number; total: bigint; disabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="min-h-14 w-full rounded-xl bg-[var(--primary)] px-5 font-hud text-sm font-bold uppercase tracking-[0.06em] text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--text-disabled)] disabled:text-[var(--surface)]">
    Explore {quantity} {quantity === 1 ? 'planet' : 'planets'} · <UsdcAmount value={total} precision={2} />
  </button>;
}
