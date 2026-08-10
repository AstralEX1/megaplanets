import type { ReactNode } from 'react';

/** Pixel-mask treatment reserved for the NFT reveal dialog. */
export function PixelTransition({ children }: { children: ReactNode }) {
  return <div className="relative overflow-hidden"><div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 opacity-25 [background-image:linear-gradient(90deg,transparent_50%,var(--primary)_50%),linear-gradient(transparent_50%,var(--primary)_50%)] [background-size:12px_12px] [mask-image:linear-gradient(135deg,transparent_18%,black_62%)]" />{children}</div>;
}
