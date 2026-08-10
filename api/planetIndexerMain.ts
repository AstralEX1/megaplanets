import { loadStage2Config } from './stage2Config';
import { createPlanetIndexerRunner, parseIndexerIntervalMs } from './planetIndexerRunner';
import { runPlanetIndexerCycle } from './planetIndexerWorker';

const config = loadStage2Config(process.env);
const runner = createPlanetIndexerRunner({
  intervalMs: parseIndexerIntervalMs(process.env),
  runCycle: () => runPlanetIndexerCycle(config),
});

await runner.start();
process.once('SIGINT', () => runner.stop());
process.once('SIGTERM', () => runner.stop());
