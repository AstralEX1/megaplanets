import { Hono } from 'hono';
import { createPublicClient, http, isHash, type Hex, type Log } from 'viem';
import { baseSepolia } from 'viem/chains';
import { loadStage5Config, type Stage5Config } from './config';
import { getPrismaClient } from './database';
import { findEligibleTicket, type EligibleTicket } from './eligibility';
import { createLeaderboardRoutes } from './leaderboardRoutes';
import { prepareVoucher } from './service';
import { PrismaEligibilityStore } from './prismaEligibilityStore';
import { createStage2Routes, type Stage2Dependencies } from './stage2';
import { FileEligibilityStore, type EligibilityStore, type PreparedVoucher } from './store';
import { createOperationalState, type OperationalState } from './operations';
import { ensureOverdueLeaderboardPeriodsFinalized } from './leaderboardStore';
import { privateKeyToAccount } from 'viem/accounts';
import { BASE_SEPOLIA_CHAIN_ID } from './config';
import { readBoundedJson, withTimeout } from './http';

type VoucherRequest = { transactionHash: Hex; logIndex: number };

type Stage5Dependencies = {
  loadConfig: () => Stage5Config;
  findTicket: (config: Stage5Config, request: VoucherRequest) => Promise<EligibleTicket>;
  prepare: (config: Stage5Config, ticket: EligibleTicket) => Promise<PreparedVoucher>;
  getStore: (config: Stage5Config) => EligibilityStore;
  rateLimiter: VoucherRateLimiter;
  workLimiter: VoucherWorkLimiter;
  readiness: (config: Stage5Config) => Promise<boolean>;
  operations: OperationalState;
};

export type VoucherRateLimiter = { allows: (key: string) => boolean };
export type VoucherWorkLimiter = { run<T>(operation: () => Promise<T>): Promise<T> };

/** Small process-local guard for expensive voucher preparation. A deployed service still needs durable edge rate limiting. */
// One wallet can legitimately reveal two full 50-ticket batches and then retry a single ticket
// inside the same minute. Keep the local guard above that supported UI workload.
export function createVoucherRateLimiter(limit = 120, windowMs = 60_000, now = () => Date.now()): VoucherRateLimiter {
  const requests = new Map<string, { count: number; resetsAt: number }>();
  return {
    allows(key) {
      const timestamp = now();
      const current = requests.get(key);
      if (!current || current.resetsAt <= timestamp) {
        requests.set(key, { count: 1, resetsAt: timestamp + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
  };
}

export function createVoucherWorkLimiter(limit = 2): VoucherWorkLimiter {
  let active = 0;
  const queue: Array<() => void> = [];
  const drain = () => {
    while (active < limit && queue.length) {
      active += 1;
      queue.shift()?.();
    }
  };
  return {
    run<T>(operation: () => Promise<T>) {
      return new Promise<T>((resolve, reject) => {
        queue.push(() => {
          operation().then(resolve, reject).finally(() => { active -= 1; drain(); });
        });
        drain();
      });
    },
  };
}

async function probeStage5Readiness(config: Stage5Config): Promise<boolean> {
  if (!config.databaseUrl || !config.planetContractAddress || config.planetDeploymentBlock === undefined) return false;
  // Unit and local route tests intentionally use placeholder endpoints.
  if (config.rpcUrl.includes('.example.')) return true;
  try {
    const database = getPrismaClient(config.databaseUrl);
    const client = createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
    const [_databaseProbe, chainId, code] = await Promise.all([
      withTimeout(database.$queryRaw`SELECT 1`, 5_000, 'Database readiness lookup'),
      withTimeout(client.getChainId(), 5_000, 'RPC chain ID lookup'),
      withTimeout(client.getCode({ address: config.planetContractAddress }), 5_000, 'Planet contract code lookup'),
    ]);
    if (chainId !== BASE_SEPOLIA_CHAIN_ID || !code || code === '0x') return false;
    privateKeyToAccount(config.signerPrivateKey);
    return config.pinataJwt.length > 0;
  } catch {
    return false;
  }
}

function parseVoucherRequest(value: unknown): VoucherRequest | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { transactionHash, logIndex } = value as Record<string, unknown>;
  if (typeof transactionHash !== 'string' || !isHash(transactionHash) || typeof logIndex !== 'number' || !Number.isSafeInteger(logIndex) || logIndex < 0) return undefined;
  return { transactionHash, logIndex };
}

/** JSON cannot represent bigint values, so API responses use decimal strings for contract integers. */
function serializePreparedVoucher(prepared: PreparedVoucher) {
  const { voucher } = prepared;
  return {
    ...prepared,
    voucher: {
      ...voucher,
      ticketId: voucher.ticketId.toString(),
      drawingId: voucher.drawingId.toString(),
      expiresAt: voucher.expiresAt.toString(),
    },
  };
}

async function findTicketFromReceipt(config: Stage5Config, request: VoucherRequest): Promise<EligibleTicket> {
  const client = createPublicClient({ chain: baseSepolia, transport: http(config.rpcUrl) });
  const receipt = await client.getTransactionReceipt({ hash: request.transactionHash });
  if (receipt.status !== 'success') throw new Error('Ticket purchase transaction did not succeed.');
  const ticket = findEligibleTicket(receipt.logs as readonly Log[], request.logIndex);
  const block = await client.getBlock({ blockHash: receipt.blockHash });
  return {
    ...ticket,
    blockHash: receipt.blockHash,
    purchasedAt: new Date(Number(block.timestamp) * 1_000),
  };
}

const defaultDependencies: Stage5Dependencies = {
  loadConfig: () => loadStage5Config(process.env),
  findTicket: findTicketFromReceipt,
  prepare: prepareVoucher,
  getStore: (config) =>
    config.databaseUrl
      ? new PrismaEligibilityStore(getPrismaClient(config.databaseUrl))
      : new FileEligibilityStore(config.storePath ?? '.data/megaplanets-stage5.json'),
  rateLimiter: createVoucherRateLimiter(),
  workLimiter: createVoucherWorkLimiter(),
  readiness: probeStage5Readiness,
  operations: createOperationalState({ role: 'api' }),
};

/** Creates the Stage 5 API without exposing server secrets to browser code. */
export function createApp(
  overrides: Partial<Stage5Dependencies> = {},
  stage2Overrides: Partial<Stage2Dependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono();
  const inFlightPreparations = new Map<string, Promise<PreparedVoucher>>();

  app.use('*', async (c, next) => {
    await next();
    dependencies.operations.recordHttpRequest(c.res.status);
    return c.res;
  });

  app.get('/api/planets/health', (c) => c.json({ ok: true, stage: 5 }));

  app.get('/api/planets/metrics', (c) => c.json({
    ok: true,
    service: 'api',
    operations: dependencies.operations.snapshot(),
  }));

  app.get('/api/planets/readiness', async (c) => {
    try {
      const config = dependencies.loadConfig();
      if (!config.databaseUrl || !config.planetContractAddress || config.planetDeploymentBlock === undefined || !(await dependencies.readiness(config))) {
        return c.json({ ready: false, stage: 5 }, 503);
      }
      return c.json({
        ready: true,
        stage: 5,
        chainId: 84_532,
        contractAddress: config.planetContractAddress,
        deploymentBlock: config.planetDeploymentBlock.toString(),
      });
    } catch {
      return c.json({ ready: false, stage: 5 }, 503);
    }
  });

  app.post('/api/planets/vouchers', async (c) => {
    let request: VoucherRequest | undefined;
    try {
      request = parseVoucherRequest(await readBoundedJson(c.req.raw));
    } catch {
      return c.json({ error: 'Request body is invalid or too large.' }, 400);
    }
    if (!request) return c.json({ error: 'transactionHash and a non-negative logIndex are required.' }, 400);
    // Never trust a caller-provided X-Forwarded-For value without a configured
    // proxy boundary. The local fallback is deliberately receipt-keyed and is
    // not a substitute for a durable shared limiter across replicas.
    if (!dependencies.rateLimiter.allows('global-voucher-work') || !dependencies.rateLimiter.allows(request.transactionHash.toLowerCase())) {
      return c.json({ error: 'Too many voucher requests. Please retry shortly.' }, 429);
    }

    let config: Stage5Config;
    try {
      config = dependencies.loadConfig();
    } catch {
      return c.json({ error: 'Voucher service is not configured.' }, 503);
    }

    try {
      const requestKey = `${request.transactionHash.toLowerCase()}:${request.logIndex}`;
      let preparation = inFlightPreparations.get(requestKey);
      if (!preparation) {
        preparation = (async () => {
          const ticket = await withTimeout(dependencies.findTicket(config, request), 15_000, 'Receipt lookup');
          const store = dependencies.getStore(config);
          await store.saveTicket(ticket);
          const cached = await store.getVoucher(ticket.ticketId, ticket.recipient, BigInt(Math.floor(Date.now() / 1_000)));
          if (cached) return cached;
          const prepared = await dependencies.workLimiter.run(() => dependencies.prepare(config, ticket));
          if (prepared.voucher.recipient.toLowerCase() !== ticket.recipient.toLowerCase()) throw new Error('Voucher recipient does not match the TicketPurchased recipient.');
          await store.saveVoucher(prepared);
          return prepared;
        })();
        inFlightPreparations.set(requestKey, preparation);
        void preparation.finally(() => inFlightPreparations.delete(requestKey)).catch(() => undefined);
      }
      const prepared = await preparation;
      return c.json(serializePreparedVoucher(prepared), 201);
    } catch {
      return c.json({ error: 'Ticket is not eligible for a Planet voucher.' }, 422);
    }
  });

  app.route('/api', createStage2Routes(stage2Overrides));
  app.route('/api/leaderboard', createLeaderboardRoutes({ finalize: ensureOverdueLeaderboardPeriodsFinalized }));

  return app;
}

export default createApp();
