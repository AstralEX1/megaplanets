/**
 * ---
 * @customize  Three-slot shell: brand mark + Nav + ProfileCard on `md+`. On
 *             mobile the `MobileBottomNav` is fixed to the viewport bottom
 *             (rendered as a sibling of `<header>`, not inside it — see
 *             `Nav.tsx` for the backdrop-filter containing-block gotcha) and
 *             a second sub-row inside the sticky header (`MobileWalletBar`)
 *             takes over the wallet affordances that ProfileCard hides
 *             below md. The spacer below the footer pushes the in-flow
 *             disclaimer above the bottom tab bar so nothing floats over
 *             page content.
 *
 *             Swap your logo by editing `BrandMark.tsx`.
 * ---
 */
import type { ReactNode } from 'react';
import { COPY } from '@/config/copy';
import { TargetCursor } from '@/components/common/TargetCursor';
import { BrandMark } from './BrandMark';
import { Footer } from './Footer';
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
      <TargetCursor spinDuration={2} hideDefaultCursor parallaxOn cursorColor="#F4F7FF" cursorColorOnTarget="#B28CFF" />
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
      <main className="relative z-10 mx-auto max-w-5xl px-4 pt-6 pb-6">{children}</main>
      <div className="relative z-10">
        <Footer />
      </div>
      <MobileBottomNav active={active} onSelect={onSelect} />
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: 'calc(env(safe-area-inset-bottom) + 64px)' }}
      />
    </div>
  );
}
