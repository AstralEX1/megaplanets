import { getPrismaClient } from './database';
import { ensureOverdueLeaderboardPeriodsFinalized } from './leaderboardStore';
import { loadStage2Config } from './stage2Config';

/** Explicit worker entry point for the mutating weekly leaderboard finalization. */
export async function runLeaderboardFinalization(env: Record<string, string | undefined> = process.env): Promise<void> {
  const config = loadStage2Config(env);
  await ensureOverdueLeaderboardPeriodsFinalized(getPrismaClient(config.databaseUrl), new Date());
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runLeaderboardFinalization().catch(() => {
    process.stderr.write('Leaderboard finalization failed.\n');
    process.exitCode = 1;
  });
}
