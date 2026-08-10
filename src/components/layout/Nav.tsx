/**
 * ---
 * @customize  No router dependency — pass `active` and `onSelect` from your shell.
 *             Replace icon imports with your icon library if you swap from inline SVG.
 *             Add or remove tabs by editing the ITEMS array (and the NavKey type).
 * ---
 *
 * Two exports, one per breakpoint:
 *   - `<Nav>`             — top-nav on `md+`, sits inline with brand + ProfileCard.
 *   - `<MobileBottomNav>` — fixed bottom-nav on mobile. MUST be rendered as a
 *                            sibling of the sticky header, not inside it: the
 *                            header uses `backdrop-blur` (`backdrop-filter`),
 *                            which creates a containing block for `position:
 *                            fixed` descendants. Nesting the bottom nav inside
 *                            the header anchors its `bottom: 0` to the header's
 *                            bottom edge instead of the viewport's, so the nav
 *                            floats just below the header (mid-page) instead
 *                            of pinning to the bottom of the screen.
 *
 * Active tab gets a colored top accent on mobile and a filled background on
 * desktop, both visible at a glance.
 */
import type { ReactNode } from 'react';
import { PlanetsIcon } from '@/components/icons/PlanetsIcon';
import { PlayIcon } from '@/components/icons/PlayIcon';

export type NavKey = 'home' | 'play' | 'tickets' | 'planets' | 'lab' | 'lp' | 'history';

// LP is gated by LP_ENABLED in src/config/contracts.ts. When disabled (the
// default), the entry is filtered out here so both `<Nav>` (desktop) and
// `<MobileBottomNav>` (mobile) render without it. The mobile bar's
// `flex-1 justify-around` rebalances from 5 → 4 tabs automatically.
const ITEMS: { key: NavKey; label: string; icon: ReactNode }[] = [
  { key: 'play', label: 'Explore planets', icon: <PlayIcon /> },
  { key: 'planets', label: 'My planets', icon: <PlanetsIcon /> },
  { key: 'history', label: 'Leaderboard', icon: <PlanetsIcon /> },
];

type NavProps = { active: NavKey; onSelect: (k: NavKey) => void };

export function Nav({ active, onSelect }: NavProps) {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
      {ITEMS.map((i) => {
        const isActive = active === i.key;
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => onSelect(i.key)}
            aria-current={isActive ? 'page' : undefined}
            className={
              'rounded-lg px-3 py-2 font-hud text-sm font-medium uppercase tracking-wide transition-colors ' +
              (isActive
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]')
            }
          >
            {i.label}
          </button>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav({ active, onSelect }: NavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[var(--border)] bg-[var(--background)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      {ITEMS.map((i) => {
        const isActive = active === i.key;
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => onSelect(i.key)}
            aria-current={isActive ? 'page' : undefined}
            className={
              'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[12px] font-medium transition-colors ' +
              'active:bg-[var(--surface-hover)] ' +
              (isActive
                ? 'text-[var(--primary)] ' +
                  'before:absolute before:top-0 before:left-1/2 before:h-0.5 before:w-8 before:-translate-x-1/2 before:bg-[var(--primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')
            }
          >
            {i.icon}
            <span>{i.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
