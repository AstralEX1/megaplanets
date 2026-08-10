import type { ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';

export function StatusBanner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'danger' }) {
  const color = tone === 'warning' ? 'var(--warning)' : tone === 'danger' ? 'var(--danger)' : 'var(--primary)';
  return <div className="flex gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]"><PixelIcon name={tone === 'info' ? 'signal' : 'alert'} className="mt-0.5 h-4 w-4 shrink-0" /><div style={{ color }}>{children}</div></div>;
}
