import type { ReactNode } from 'react';

export function TacticalPanel({
  label,
  children,
  className = '',
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`sci-panel ${className}`}>
      {label && <p className="telemetry border-b border-[var(--border)] px-4 py-2 text-[var(--text-muted)]">{label}</p>}
      {children}
    </section>
  );
}
