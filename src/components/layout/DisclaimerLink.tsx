/**
 * Disclaimer link rendered inside <Footer />. The URL is hardcoded so the
 * legal acknowledgement remains visible without runtime configuration.
 */
import type { ReactNode } from 'react';

const DISCLAIMER_URL =
  'https://github.com/AstralEX1/megaplanets/blob/main/docs/DISCLAIMER.md';

export function DisclaimerLink({
  children = 'full disclaimer',
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={DISCLAIMER_URL}
      target="_blank"
      rel="noreferrer"
      className={`underline underline-offset-2 ${className ?? 'hover:text-zinc-700 dark:hover:text-zinc-200'}`.trim()}
    >
      {children}
    </a>
  );
}
