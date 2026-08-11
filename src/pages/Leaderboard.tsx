import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { WalletRankCard } from '@/components/leaderboard/WalletRankCard';
import { WeekProgress } from '@/components/leaderboard/WeekProgress';
import { useArchivedLeaderboard, useCurrentLeaderboard, useLeaderboardHistory, useWalletLeaderboardPosition } from '@/hooks/useLeaderboard';

function weekLabel(startsAt: string, prefix = '') {
  return `${prefix}${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(startsAt))}`;
}

export function Leaderboard() {
  const { address } = useAccount();
  const [periodId, setPeriodId] = useState('current');
  const current = useCurrentLeaderboard();
  const wallet = useWalletLeaderboardPosition(address);
  const history = useLeaderboardHistory();
  const archived = useArchivedLeaderboard(periodId === 'current' ? undefined : periodId);
  const selected = periodId === 'current' ? current : archived;
  const data = selected.data;

  if (selected.isLoading) return <section className="card-pad mx-auto max-w-3xl text-center"><h1 className="font-hud text-2xl font-bold">Loading leaderboard</h1></section>;
  if (selected.error || !data) return (
    <section className="card-pad mx-auto max-w-2xl space-y-4 text-center">
      <h1 className="font-hud text-2xl font-bold">Leaderboard unavailable</h1>
      <p className="text-sm text-[var(--text-secondary)]">The mining backend could not return weekly standings.</p>
      <Button variant="secondary" onClick={() => void selected.refetch()}>Retry</Button>
    </section>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div><p className="telemetry text-violet-300">Off-chain mineral score</p><h1 className="mt-1 font-hud text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">Leaderboard</h1></div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><span>Week</span><select aria-label="Leaderboard week" value={periodId} onChange={(event) => setPeriodId(event.target.value)} className="min-h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 font-semibold text-[var(--text-primary)]"><option value="current">{weekLabel(current.data?.period.startsAt ?? data.period.startsAt, 'Current week · ')}</option>{history.data?.periods.map((period) => <option key={period.id} value={period.id}>{weekLabel(period.startsAt)}</option>)}</select></label>
      </header>

      {periodId === 'current' && data.asOf ? <WeekProgress period={data.period} asOf={data.asOf} /> : null}

      {data.rows.length === 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center"><h2 className="font-hud text-xl font-bold">No mineral production yet</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">Standings appear after the first revealed Planet begins mining.</p></section>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <LeaderboardTable rows={data.rows} walletAddress={address} />
          {address && periodId === 'current' && wallet.data ? <WalletRankCard position={wallet.data} /> : null}
        </div>
      )}
    </div>
  );
}
