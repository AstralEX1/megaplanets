import { describe, expect, it } from 'vitest';
import type { Stage5Config } from './config';
import { createApp, createVoucherRateLimiter } from './index';
import type { EligibleTicket } from './eligibility';
import type { MintVoucher } from './voucher';
import { MemoryEligibilityStore } from './store';
import { createOperationalState } from './operations';

const config: Stage5Config = {
  rpcUrl: 'https://rpc.example.test',
  rpcFallbackUrls: [],
  databaseUrl: 'postgresql://not-used-in-tests',
  pinataJwt: 'test-pinata-token',
  signerPrivateKey: `0x${'11'.repeat(32)}`,
  launchBlock: 44_997_183n,
  storePath: 'not-used-in-tests.json',
  planetContractAddress: '0x2222222222222222222222222222222222222222',
};

const ticket: EligibleTicket = {
  recipient: '0x3333333333333333333333333333333333333333',
  ticketId: 456n,
  drawingId: 123n,
  normals: [2, 7, 14, 22, 29],
  bonusBall: 9,
  originTxHash: `0x${'ab'.repeat(32)}`,
  blockNumber: 44_997_183n,
  logIndex: 4n,
};

const requestBody = { transactionHash: ticket.originTxHash, logIndex: 4 };
const voucher: MintVoucher = {
  recipient: ticket.recipient,
  ticketId: ticket.ticketId,
  drawingId: ticket.drawingId,
  originTxHash: ticket.originTxHash,
  seed: `0x${'aa'.repeat(32)}`,
  traitsHash: `0x${'bb'.repeat(32)}`,
  metadataHash: `0x${'cc'.repeat(32)}`,
  metadataURI: 'ipfs://metadata-cid',
  expiresAt: 1_800_000_000n,
};

describe('Stage 5 voucher endpoint', () => {
  it('exposes health and V2 configuration readiness probes', async () => {
    const app = createApp({ loadConfig: () => ({ ...config, planetDeploymentBlock: 45_347_860n }) });

    expect(await (await app.request('/api/planets/health')).json()).toEqual({ ok: true, stage: 5 });
    expect(await (await app.request('/api/planets/readiness')).json()).toEqual({
      ready: true,
      stage: 5,
      chainId: 84_532,
      contractAddress: config.planetContractAddress,
      deploymentBlock: '45347860',
    });
  });

  it('exposes safe operational metrics without server credentials', async () => {
    const operations = createOperationalState({ role: 'api', now: () => 1_700_000_000_000 });
    const app = createApp({ operations, loadConfig: () => ({ ...config, planetDeploymentBlock: 45_347_860n }) });

    const response = await app.request('/api/planets/metrics');

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      service: 'api',
      operations: {
        requestsTotal: 0,
        errorsTotal: 0,
        indexerCyclesTotal: 0,
      },
    });
    expect(JSON.stringify(payload)).not.toContain('DATABASE_URL');
  });

  it('keeps readiness closed when the database or deployment block is missing', async () => {
    const app = createApp({ loadConfig: () => ({ ...config, databaseUrl: undefined, planetDeploymentBlock: undefined }) });

    const response = await app.request('/api/planets/readiness');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ready: false, stage: 5 });
  });

  it('mounts the public leaderboard API under /api/leaderboard', async () => {
    const response = await createApp().request('/api/leaderboard/current?limit=101');

    expect(response.status).toBe(400);
  });

  it('rejects malformed receipt references before reading server configuration', async () => {
    const app = createApp();
    const response = await app.request('/api/planets/vouchers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: 'not-a-hash', logIndex: -1 }),
    });

    expect(response.status).toBe(400);
  });

  it('creates a voucher only from the requested confirmed receipt log', async () => {
    let resolvedLogIndex: number | undefined;
    const app = createApp({
      loadConfig: () => config,
      findTicket: async (_config, request) => {
        resolvedLogIndex = request.logIndex;
        expect(request.transactionHash).toBe(ticket.originTxHash);
        return ticket;
      },
      prepare: async () => ({
        voucher,
        signature: '0xdeadbeef',
        signer: '0x4444444444444444444444444444444444444444',
        digest: `0x${'cd'.repeat(32)}`,
      }),
      getStore: () => new MemoryEligibilityStore(),
    });
    const response = await app.request('/api/planets/vouchers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(201);
    expect(resolvedLogIndex).toBe(4);
    expect(await response.json()).toMatchObject({
      voucher: { ticketId: '456', drawingId: '123', expiresAt: '1800000000' },
      signature: '0xdeadbeef',
    });
  });

  it('does not resolve a receipt when the server is not configured', async () => {
    let wasResolved = false;
    const app = createApp({
      loadConfig: () => {
        throw new Error('missing configuration');
      },
      findTicket: async () => {
        wasResolved = true;
        return ticket;
      },
    });
    const response = await app.request('/api/planets/vouchers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(503);
    expect(wasResolved).toBe(false);
  });

  it('coalesces concurrent requests for the same receipt log', async () => {
    let preparations = 0;
    const app = createApp({
      loadConfig: () => config,
      findTicket: async () => ticket,
      prepare: async () => {
        preparations += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          voucher,
          signature: '0xdeadbeef',
          signer: '0x4444444444444444444444444444444444444444',
          digest: `0x${'cd'.repeat(32)}`,
        };
      },
      getStore: () => new MemoryEligibilityStore(),
    });
    const request = () =>
      app.request('/api/planets/vouchers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

    const [first, second] = await Promise.all([request(), request()]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(preparations).toBe(1);
  });

  it('reuses a non-expired durable voucher for the purchase recipient', async () => {
    let preparations = 0;
    const store = new MemoryEligibilityStore();
    const app = createApp({
      loadConfig: () => config,
      findTicket: async () => ticket,
      getStore: () => store,
      prepare: async () => {
        preparations += 1;
        return { voucher, signature: '0xdeadbeef', signer: '0x4444444444444444444444444444444444444444', digest: `0x${'cd'.repeat(32)}` };
      },
    });
    const request = () => app.request('/api/planets/vouchers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody) });

    expect((await request()).status).toBe(201);
    expect((await request()).status).toBe(201);
    expect(preparations).toBe(1);
  });

  it('rate-limits expensive voucher preparation by client key', () => {
    let now = 0;
    const limiter = createVoucherRateLimiter(2, 1_000, () => now);

    expect(limiter.allows('client')).toBe(true);
    expect(limiter.allows('client')).toBe(true);
    expect(limiter.allows('client')).toBe(false);
    now = 1_000;
    expect(limiter.allows('client')).toBe(true);
  });

  it('allows two complete reveal batches and a following single reveal', async () => {
    const store = new MemoryEligibilityStore();
    const app = createApp({
      loadConfig: () => config,
      rateLimiter: createVoucherRateLimiter(),
      findTicket: async (_config, request) => ({
        ...ticket,
        ticketId: BigInt(request.logIndex + 1),
        logIndex: BigInt(request.logIndex),
      }),
      prepare: async (_config, eligibleTicket) => ({
        voucher: {
          ...voucher,
          ticketId: eligibleTicket.ticketId,
          drawingId: eligibleTicket.drawingId,
          originTxHash: eligibleTicket.originTxHash,
          recipient: eligibleTicket.recipient,
        },
        signature: '0xdeadbeef',
        signer: '0x4444444444444444444444444444444444444444',
        digest: `0x${'cd'.repeat(32)}`,
      }),
      getStore: () => store,
    });

    const statuses: number[] = [];
    for (let logIndex = 0; logIndex < 101; logIndex += 1) {
      const response = await app.request('/api/planets/vouchers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionHash: ticket.originTxHash, logIndex }),
      });
      statuses.push(response.status);
    }

    expect(statuses).toEqual(Array.from({ length: 101 }, () => 201));
  });
});
