import { describe, expect, it, vi } from 'vitest';
import { createPlanetIndexerRunner, parseIndexerIntervalMs } from './planetIndexerRunner';

describe('Planet indexer runner', () => {
  it('runs immediately and skips an overlapping scheduled cycle', async () => {
    let release: (() => void) | undefined;
    const running = new Promise<void>((resolve) => { release = resolve; });
    const runCycle = vi.fn(async () => { if (runCycle.mock.calls.length === 1) await running; });
    let scheduled: (() => void) | undefined;
    const runner = createPlanetIndexerRunner({
      intervalMs: 30_000,
      runCycle,
      schedule: (callback) => { scheduled = callback; return 1 as unknown as ReturnType<typeof setInterval>; },
      clearSchedule: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
    });

    const started = runner.start();
    await Promise.resolve();
    scheduled?.();
    expect(runCycle).toHaveBeenCalledTimes(1);
    release?.();
    await started;
    runner.stop();
  });

  it('defaults to thirty seconds and rejects invalid intervals', () => {
    expect(parseIndexerIntervalMs({})).toBe(30_000);
    expect(() => parseIndexerIntervalMs({ MEGAPLANETS_INDEXER_INTERVAL_MS: '0' })).toThrow('interval');
  });
});
