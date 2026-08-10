export type IndexerLogger = {
  info: (message: string) => void;
  error: (message: string, error: unknown) => void;
};

export type PlanetIndexerRunnerOptions = {
  intervalMs: number;
  runCycle: () => Promise<unknown>;
  log?: IndexerLogger;
  schedule?: (callback: () => void, intervalMs: number) => ReturnType<typeof setInterval>;
  clearSchedule?: (timer: ReturnType<typeof setInterval>) => void;
};

export type PlanetIndexerRunner = { start: () => Promise<void>; stop: () => void };

export function parseIndexerIntervalMs(env: Record<string, string | undefined>): number {
  const raw = env.MEGAPLANETS_INDEXER_INTERVAL_MS;
  if (!raw?.trim()) return 30_000;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > 3_600_000) {
    throw new Error('MEGAPLANETS_INDEXER_INTERVAL_MS must be a valid interval.');
  }
  return value;
}

/** Runs immediately, then repeats without allowing overlapping cycles. */
export function createPlanetIndexerRunner(options: PlanetIndexerRunnerOptions): PlanetIndexerRunner {
  const log = options.log ?? console;
  const schedule = options.schedule ?? setInterval;
  const clearSchedule = options.clearSchedule ?? clearInterval;
  let active: Promise<void> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const cycle = async () => {
    if (active) return active;
    active = (async () => {
      try {
        await options.runCycle();
        log.info('Planet indexer cycle completed.');
      } catch (error) {
        log.error('Planet indexer cycle failed.', error);
      } finally {
        active = undefined;
      }
    })();
    return active;
  };
  return {
    async start() {
      if (timer) return;
      timer = schedule(() => void cycle(), options.intervalMs);
      await cycle();
    },
    stop() {
      if (!timer) return;
      clearSchedule(timer);
      timer = undefined;
    },
  };
}
