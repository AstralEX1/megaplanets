import type { LeaderboardRow } from '@/hooks/useLeaderboard';
import { formatMinerals } from '@/lib/minerals';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function isWallet(row: LeaderboardRow, walletAddress?: string) {
  return !!walletAddress && row.walletAddress.toLowerCase() === walletAddress.toLowerCase();
}

export function LeaderboardTable({ rows, walletAddress }: { rows: LeaderboardRow[]; walletAddress?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="hidden w-full table-fixed md:table">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-left telemetry text-[var(--text-secondary)]">
          <tr><th className="w-20 px-4 py-3">Rank</th><th className="px-4 py-3">Wallet</th><th className="px-4 py-3 text-right">Minerals</th><th className="px-4 py-3 text-right">Per day</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const own = isWallet(row, walletAddress);
            return (
              <tr key={row.walletAddress} data-wallet-row={own ? 'true' : undefined} className={`border-b border-[var(--border)] last:border-0 ${own ? 'bg-violet-500/10' : ''}`}>
                <td className="px-4 py-4 font-hud text-lg font-bold text-[var(--text-primary)]">#{row.rank}</td>
                <td className="px-4 py-4 font-mono text-sm text-[var(--text-secondary)]" title={row.walletAddress}>{shortAddress(row.walletAddress)}{own ? <span className="ml-2 text-violet-300">You</span> : null}</td>
                <td className="px-4 py-4 text-right font-hud font-bold text-[var(--text-primary)]">{formatMinerals(BigInt(row.scoreMicros))}</td>
                <td className="px-4 py-4 text-right font-mono text-sm text-[var(--text-secondary)]">{formatMinerals(BigInt(row.effectiveMineralsPerDayMicros))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div data-mobile-standings className="divide-y divide-[var(--border)] md:hidden">
        {rows.map((row) => {
          const own = isWallet(row, walletAddress);
          return (
            <article key={row.walletAddress} data-wallet-row={own ? 'true' : undefined} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4 ${own ? 'bg-violet-500/10' : ''}`}>
              <span className="font-hud text-xl font-bold text-[var(--text-primary)]">#{row.rank}</span>
              <span className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]">{shortAddress(row.walletAddress)}</span>
              <div className="text-right"><p className="font-hud font-bold text-[var(--text-primary)]">{formatMinerals(BigInt(row.scoreMicros))}</p><p className="font-mono text-[11px] text-[var(--text-secondary)]">+{formatMinerals(BigInt(row.effectiveMineralsPerDayMicros))}/day</p></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
