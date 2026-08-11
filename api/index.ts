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

type VoucherRequest = { transactionHash: Hex; logIndex: number };

type Stage5Dependencies = {
  loadConfig: () => Stage5Config;
  findTicket: (config: Stage5Config, request: VoucherRequest) => Promise<EligibleTicket>;
  prepare: (config: Stage5Config, ticket: EligibleTicket) => Promise<PreparedVoucher>;
  getStore: (config: Stage5Config) => EligibilityStore;
  rateLimiter: VoucherRateLimiter;
};

export type VoucherRateLimiter = { allows: (key: string) => boolean };

/** Small process-local guard for expensive voucher preparation. A deployed service still needs durable edge rate limiting. */
export function createVoucherRateLimiter(limit = 10, windowMs = 60_000, now = () => Date.now()): VoucherRateLimiter {
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
};

/** Creates the Stage 5 API without exposing server secrets to browser code. */
export function createApp(
  overrides: Partial<Stage5Dependencies> = {},
  stage2Overrides: Partial<Stage2Dependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono();
  const inFlightPreparations = new Map<string, Promise<PreparedVoucher>>();

  app.get('/api/planets/health', (c) => c.json({ ok: true, stage: 5 }));

  app.post('/api/planets/vouchers', async (c) => {
    const clientKey = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
    if (!dependencies.rateLimiter.allows(clientKey)) {
      return c.json({ error: 'Too many voucher requests. Please retry shortly.' }, 429);
    }
    const request = parseVoucherRequest(await c.req.json().catch(() => undefined));
    if (!request) return c.json({ error: 'transactionHash and a non-negative logIndex are required.' }, 400);

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
          const ticket = await dependencies.findTicket(config, request);
          const store = dependencies.getStore(config);
          await store.saveTicket(ticket);
          const cached = await store.getVoucher(ticket.ticketId, ticket.recipient, BigInt(Math.floor(Date.now() / 1_000)));
          if (cached) return cached;
          const prepared = await dependencies.prepare(config, ticket);
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
  app.route('/api/leaderboard', createLeaderboardRoutes());

  return app;
}

export default createApp();
