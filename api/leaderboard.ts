const DAY_MILLISECONDS = 24 * 60 * 60 * 1_000;

export type LeaderboardPeriodBounds = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

export type UnrankedLeaderboardRow = {
  walletAddress: string;
  scoreMicros: bigint;
  effectiveMineralsPerDayMicros: bigint;
};

export type RankedLeaderboardRow = UnrankedLeaderboardRow & {
  rank: number;
};

function normalizeWalletAddress(address: string): string {
  return address.toLowerCase();
}

function formatPeriodId(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Returns the UTC calendar-day leaderboard period containing the timestamp. */
export function getLeaderboardPeriod(now: Date): LeaderboardPeriodBounds {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    id: formatPeriodId(startsAt),
    startsAt,
    endsAt: new Date(startsAt.getTime() + DAY_MILLISECONDS),
  };
}

/** Alias that makes the UTC-day snapshot boundary explicit at call sites. */
export const getLeaderboardDay = getLeaderboardPeriod;

/** Sorts leaderboard rows deterministically and assigns one-based ordinal ranks. */
export function rankLeaderboardRows(
  rows: readonly UnrankedLeaderboardRow[],
): RankedLeaderboardRow[] {
  return rows
    .map((row) => ({ ...row, walletAddress: normalizeWalletAddress(row.walletAddress) }))
    .sort((left, right) => {
      if (left.scoreMicros !== right.scoreMicros)
        return left.scoreMicros > right.scoreMicros ? -1 : 1;
      return left.walletAddress.localeCompare(right.walletAddress);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Returns the mineral score gap between a wallet and the row immediately above it. */
export function getDistanceToNextRank(
  rows: readonly RankedLeaderboardRow[],
  walletAddress: string,
): string | null {
  const index = rows.findIndex(
    (row) => row.walletAddress === normalizeWalletAddress(walletAddress),
  );
  if (index <= 0) return null;
  return (rows[index - 1].scoreMicros - rows[index].scoreMicros).toString();
}
