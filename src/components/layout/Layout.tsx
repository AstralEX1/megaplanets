/**
 * ---
 * @customize  Three-slot shell: brand mark + Nav + ProfileCard on `md+`. On
 *             mobile the `MobileBottomNav` is fixed to the viewport bottom
 *             (rendered as a sibling of `<header>`, not inside it — see
 *             `Nav.tsx` for the backdrop-filter containing-block gotcha) and
 *             a second sub-row inside the sticky header (`MobileWalletBar`)
 *             takes over the wallet affordances that ProfileCard hides
 *             below md. The final spacer keeps page content clear of the
 *             fixed mobile bottom navigation.
 *
 *             Swap your logo by editing `BrandMark.tsx`.
 * ---
 */
import type { ReactNode } from 'react';
import { COPY } from '@/config/copy';
import { BrandMark } from './BrandMark';
import { MobileWalletBar } from './MobileWalletBar';
import { MobileBottomNav, Nav, type NavKey } from './Nav';
import { ProfileCard } from './ProfileCard';

export function Layout({
  active,
  onSelect,
  children,
}: {
  active: NavKey;
  onSelect: (k: NavKey) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-shell relative isolate min-h-screen text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <a
            href="/"
            className="flex items-center gap-2 whitespace-nowrap font-semibold tracking-[0.08em] text-[#e8f7ff]"
          >
            <BrandMark />
            <span>
              {COPY.brandShort}
              <span className="hidden sm:inline">{COPY.brandSuffix}</span>
            </span>
          </a>
          <Nav active={active} onSelect={onSelect} />
          <ProfileCard />
        </div>
        <MobileWalletBar />
      </header>
      <main className={`relative z-10 mx-auto w-full px-4 pt-6 pb-6 ${active === 'planets' ? 'max-w-[1480px]' : 'max-w-5xl'}`}>{children}</main>
      <MobileBottomNav active={active} onSelect={onSelect} />
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: 'calc(env(safe-area-inset-bottom) + 64px)' }}
      />
    </div>
  );
}
