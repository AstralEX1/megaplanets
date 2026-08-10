/**
 * ---
 * @customize  Single source of truth for the ball/number circle used across
 *             TicketCard, the History winning-numbers strip, the
 *             TicketBuilder random preview, and the TicketPicker grid.
 *             Edit the palette tokens here to rebrand every ball at once.
 *
 *             Variants:
 *               - normal — emerald palette when selected, neutral outline
 *                          when not.
 *               - bonus  — amber palette in both states.
 *             Sizes:
 *               - sm   — h-5 w-5 text-[11px] (random preview, tight rows)
 *               - md   — h-6 w-6 text-xs    (default; rows on Tickets/History)
 *               - fill — aspect-square w-full (picker grid cells)
 *             Set `interactive` to render as a focusable <button aria-pressed>;
 *             omit for a decorative <span>.
 * ---
 */
import type { CSSProperties } from 'react';

export type BallVariant = 'normal' | 'bonus';
export type BallSize = 'sm' | 'md' | 'fill';

const SIZE_CLASSES: Record<BallSize, string> = {
  sm: 'h-5 w-5 text-[11px]',
  md: 'h-6 w-6 text-xs',
  fill: 'aspect-square w-full text-sm',
};

const NORMAL_SELECTED =
  'border-[var(--accent)] bg-[var(--accent)] text-white';
const NORMAL_UNSELECTED = 'border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text-primary)]';
const BONUS_SELECTED = 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]';
const BONUS_UNSELECTED = 'border-[var(--primary)]/60 bg-[var(--surface-raised)] text-[var(--primary)]';

export type BallProps = {
  n: number | string;
  variant?: BallVariant;
  selected?: boolean;
  size?: BallSize;
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
  title?: string;
  style?: CSSProperties;
};

export function Ball({
  n,
  variant = 'normal',
  selected = false,
  size = 'md',
  interactive = false,
  onClick,
  ariaLabel,
  className = '',
  title,
  style,
}: BallProps) {
  const palette =
    variant === 'bonus'
      ? selected
        ? BONUS_SELECTED
        : BONUS_UNSELECTED
      : selected
        ? NORMAL_SELECTED
        : NORMAL_UNSELECTED;

  const base =
    'inline-flex items-center justify-center rounded-full border ' +
    'font-mono tabular-nums transition-colors ' +
    SIZE_CLASSES[size] +
    ' ' +
    palette +
    (className ? ` ${className}` : '');

  if (interactive) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={ariaLabel ?? String(n)}
        onClick={onClick}
        title={title}
        style={style}
        className={`${base} cursor-pointer hover:opacity-90 active:scale-95`}
      >
        {n}
      </button>
    );
  }

  return (
    <span title={title} style={style} className={base}>
      {n}
    </span>
  );
}
