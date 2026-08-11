import { useEffect, useState } from 'react';
import type { LeaderboardPeriod } from '@/hooks/useLeaderboard';

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function WeekProgress({ period, asOf }: { period: LeaderboardPeriod; asOf: string }) {
  const [now, setNow] = useState(() => new Date(asOf));
  useEffect(() => {
    setNow(new Date(asOf));
    const interval = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(interval);
  }, [asOf]);
  const startsAt = new Date(period.startsAt).getTime();
  const endsAt = new Date(period.endsAt).getTime();
  const progress = Math.max(0, Math.min(100, (now.getTime() - startsAt) / (endsAt - startsAt) * 100));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="telemetry text-[var(--text-secondary)]">UTC mining week</span>
        <span className="font-mono font-semibold text-[var(--text-primary)]">{formatCountdown(endsAt - now.getTime())}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Current week progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="relative mt-3 h-2 overflow-visible rounded-full bg-[var(--surface-raised)]"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-300" style={{ width: `${progress}%` }} />
        <span aria-hidden className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.9)]" style={{ left: `${progress}%` }} />
      </div>
    </div>
  );
}
