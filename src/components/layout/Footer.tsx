/**
 * Disclaimer footer. Rendered as a normal in-flow footer on every breakpoint.
 * On mobile, <Layout /> adds a spacer after the footer so it remains visible
 * above the fixed bottom navigation.
 */
import { COPY } from '@/config/copy';
import { DisclaimerLink } from './DisclaimerLink';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white/50 px-4 py-4 text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400 md:py-6 md:text-xs">
      <p className="mx-auto max-w-5xl text-center md:text-left">
        <span className="hidden md:inline">{COPY.disclaimerLineDesktop} See </span>
        <span className="md:hidden">{COPY.disclaimerLineMobile} · </span>
        <DisclaimerLink>{COPY.disclaimerLinkText}</DisclaimerLink>
        <span className="hidden md:inline">.</span>
      </p>
    </footer>
  );
}
