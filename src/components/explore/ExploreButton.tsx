import { UsdcAmount } from '@/components/common/UsdcAmount';

export function ExploreButton({ quantity, total, disabled, onClick }: { quantity: number; total: bigint; disabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="min-h-14 w-full rounded-[14px] bg-[var(--primary)] px-5 font-hud text-sm font-bold uppercase tracking-[0.02em] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--text-disabled)] disabled:text-[var(--surface)]">
    Explore {quantity} · <UsdcAmount value={total} precision={2} unit={false} /> USDC
  </button>;
}
