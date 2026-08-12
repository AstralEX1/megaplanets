import { loadStage2Config } from './stage2Config';
import { createPlanetIndexerRunner, parseIndexerIntervalMs } from './planetIndexerRunner';
import { runPlanetIndexerCycle } from './planetIndexerWorker';
import { createOperationalState } from './operations';

const config = loadStage2Config(process.env);
const operations = createOperationalState({ role: 'indexer' });
const runner = createPlanetIndexerRunner({
  intervalMs: parseIndexerIntervalMs(process.env),
  runCycle: async () => {
    const startedAt = Date.now();
    try {
      const result = await runPlanetIndexerCycle(config);
      operations.recordIndexerCycle(result, Date.now() - startedAt);
      process.stdout.write(`${JSON.stringify({ event: 'indexer_cycle', ...operations.snapshot() })}\n`);
      return result;
    } catch (error) {
      operations.recordIndexerFailure(Date.now() - startedAt);
      process.stderr.write(`${JSON.stringify({ event: 'indexer_failure', ...operations.snapshot() })}\n`);
      throw error;
    }
  },
});

await runner.start();
process.once('SIGINT', () => runner.stop());
process.once('SIGTERM', () => runner.stop());
