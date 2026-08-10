import type { ReactNode } from 'react';

/** Lightweight local adaptation of React Bits' animated border treatment. */
export function StarBorder({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`relative overflow-hidden sci-cut bg-[var(--primary)] p-px shadow-[0_0_24px_rgb(99_230_255_/_25%)] ${className}`}><div className="absolute inset-0 animate-pulse bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,.9)_50%,transparent_80%)]" /><div className="relative sci-cut bg-[#07111f]">{children}</div></div>;
}
