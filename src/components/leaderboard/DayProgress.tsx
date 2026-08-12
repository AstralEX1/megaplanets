import type { LeaderboardPeriod } from '@/hooks/useLeaderboard';

export function DayProgress({ period, asOf }: { period: LeaderboardPeriod; asOf: string }) {
  const startsAt = new Date(period.startsAt).getTime();
  const endsAt = new Date(period.endsAt).getTime();
  const snapshotAt = new Date(asOf).getTime();
  const progress = Math.max(0, Math.min(100, (snapshotAt - startsAt) / (endsAt - startsAt) * 100));

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="telemetry text-[var(--text-secondary)]">UTC daily snapshot</span>
        <span className="font-mono font-semibold text-[var(--text-primary)]">As of {new Date(asOf).toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC</span>
      </div>
      <div
        role="progressbar"
        aria-label="Daily snapshot progress"
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
