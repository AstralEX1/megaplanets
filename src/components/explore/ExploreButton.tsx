import type { ReactNode } from 'react';
import { UsdcAmount } from '@/components/common/UsdcAmount';

export function ExploreButton({
  quantity,
  total,
  disabled,
  onClick,
  label,
}: {
  quantity: number;
  total: bigint;
  disabled: boolean;
  onClick: () => void;
  label?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-14 w-full rounded-[14px] bg-[var(--primary)] px-5 font-hud text-sm font-bold uppercase tracking-[0.02em] text-[var(--primary-foreground)] transition-[scale,background-color] duration-150 ease-out active:not-disabled:scale-[0.96] hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--text-disabled)] disabled:text-[var(--surface)]"
    >
      {label ?? (
        <>
          Explore {quantity} · <UsdcAmount value={total} precision={2} unit={false} /> USDC
        </>
      )}
    </button>
  );
}
