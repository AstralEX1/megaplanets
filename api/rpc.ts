export type AdaptiveLogOptions = {
  fromBlock: bigint;
  toBlock: bigint;
  initialRange?: bigint;
  minRange?: bigint;
  maxRange?: bigint;
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/** Reads logs in provider-friendly chunks, shrinking on range/timeout errors. */
export async function getLogsAdaptive<T>(
  options: AdaptiveLogOptions,
  read: (fromBlock: bigint, toBlock: bigint) => Promise<readonly T[]>,
): Promise<T[]> {
  const minRange = options.minRange ?? 32n;
  const maxRange = options.maxRange ?? 2_000n;
  let range = options.initialRange ?? maxRange;
  if (minRange < 1n || maxRange < minRange || range < minRange || range > maxRange || options.fromBlock > options.toBlock) {
    throw new Error('Invalid adaptive RPC log bounds.');
  }
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logs: T[] = [];
  for (let from = options.fromBlock; from <= options.toBlock;) {
    const to = from + range - 1n > options.toBlock ? options.toBlock : from + range - 1n;
    try {
      logs.push(...await read(from, to));
      from = to + 1n;
      range = range < maxRange ? range * 2n > maxRange ? maxRange : range * 2n : range;
    } catch (error) {
      if (range === minRange) throw error;
      range = range / 2n < minRange ? minRange : range / 2n;
      await sleep(options.backoffMs ?? 100);
    }
  }
  return logs;
}
