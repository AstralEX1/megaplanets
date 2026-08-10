/**
 * ---
 * @customize  Single button primitive — 3 variants cover every action
 *             surface in the kit. White-labeling a button style means
 *             editing the maps below; consumers stay unchanged.
 *
 *             Variants:
 *               - primary   — the brand CTA (Buy, Deposit, Claim, Finalize)
 *               - secondary — neutral / zinc (Approve, Initiate withdraw,
 *                             quiet confirmations)
 *               - danger    — destructive / error (Cancel, Wrong network)
 *
 *             Sizes:
 *               - sm — compact in-card actions
 *               - md — page-level submits (default)
 *               - lg — hero / page-level CTAs (e.g. Home "Play now")
 *
 *             To add a variant, append to `VARIANT_CLASSES` and the
 *             `Variant` union. Same for sizes. Consumers pass `variant`
 *             and `size`; pass-through `className` is appended last so a
 *             caller can override (e.g. `w-full`).
 * ---
 */
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]',
  secondary:
    'border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
  danger:
    'bg-[var(--danger)] text-[#28070d] hover:brightness-110',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'rounded-lg px-3 py-2 text-xs font-semibold',
  md: 'rounded-lg px-4 py-2.5 text-sm font-semibold',
  lg: 'rounded-xl px-6 py-4 text-base font-semibold',
};

const BASE_CLASSES =
  'font-hud uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes =
    `${BASE_CLASSES} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`.trim();
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
