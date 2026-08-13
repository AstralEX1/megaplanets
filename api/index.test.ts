import { afterEach, describe, expect, it, vi } from 'vitest';
import { BASE_SEPOLIA_CHAIN_ID } from './config';
import type { Stage5Config } from './config';
import {
  assertReceiptFinality,
  createApp,
  createDefaultEligibilityStore,
  createVoucherRateLimiter,
  probeStage5Readiness,
  readMetadataSigner,
} from './index';
import type { EligibleTicket } from './eligibility';
import type { MintVoucher } from './voucher';
import { MemoryEligibilityStore } from './store';
import { createOperationalState } from './operations';
import { parseAllowedOrigins } from './cors';

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
  afterEach(() => vi.unstubAllEnvs());

  it('rejects the local voucher store when production has no PostgreSQL database', () => {
    expect(() => createDefaultEligibilityStore({ ...config, databaseUrl: undefined }, { NODE_ENV: 'production' })).toThrow(/PostgreSQL/i);
  });

  it('reads and validates the V2 metadata signer before readiness succeeds', async () => {
    const expected = `0x${'11'.repeat(20)}` as `0x${string}`;
    const actual = await readMetadataSigner(async () => expected.toLowerCase());
    expect(actual).toBe(expected.toLowerCase());
    await expect(readMetadataSigner(async () => 'not-an-address')).rejects.toThrow(/metadata signer/i);
  });

  it('closes default readiness when the on-chain metadata signer differs', async () => {
    const result = await probeStage5Readiness({ ...config, planetDeploymentBlock: 45_347_860n }, {
      databaseProbe: async () => undefined,
      readChain: async () => ({
        chainId: BASE_SEPOLIA_CHAIN_ID,
        code: `0x${'aa'.repeat(20)}`,
        metadataSigner: `0x${'22'.repeat(20)}`,
      }),
    });
    expect(result).toBe(false);
  });

  it('returns 503 before receipt work when production has no PostgreSQL database', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    let resolved = false;
    const app = createApp({
      loadConfig: () => ({ ...config, databaseUrl: undefined }),
      findTicket: async () => {
        resolved = true;
        return ticket;
      },
    });
    const response = await app.request('/api/planets/vouchers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    expect(response.status).toBe(503);
    expect(resolved).toBe(false);
  });

  it('accepts a receipt only after the configured confirmation depth and canonical block hash check', () => {
    expect(() => assertReceiptFinality({
      blockNumber: 100n,
      blockHash: `0x${'aa'.repeat(32)}`,
    }, {
      latestBlock: 106n,
      canonicalBlockHash: `0x${'aa'.repeat(32)}`,
      confirmations: 6n,
    })).not.toThrow();
    expect(() => assertReceiptFinality({
      blockNumber: 100n,
      blockHash: `0x${'aa'.repeat(32)}`,
    }, {
      latestBlock: 105n,
      canonicalBlockHash: `0x${'aa'.repeat(32)}`,
      confirmations: 6n,
    })).toThrow(/confirm/i);
    expect(() => assertReceiptFinality({
      blockNumber: 100n,
      blockHash: `0x${'aa'.repeat(32)}`,
    }, {
      latestBlock: 106n,
      canonicalBlockHash: `0x${'bb'.repeat(32)}`,
      confirmations: 6n,
    })).toThrow(/canonical|reorg|block hash/i);
  });

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

  it('allows only explicitly configured frontend origins', async () => {
    vi.stubEnv('MEGAPLANETS_ALLOWED_ORIGINS', 'https://demo.megaplanets.example, http://localhost:5173');
    const app = createApp();

    const allowed = await app.request('/api/planets/health', {
      headers: { Origin: 'https://demo.megaplanets.example' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://demo.megaplanets.example');

    const preflight = await app.request('/api/planets/health', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

    const denied = await app.request('/api/planets/health', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('rejects wildcard and malformed CORS allowlists', () => {
    expect(() => parseAllowedOrigins({ MEGAPLANETS_ALLOWED_ORIGINS: '*' })).toThrow(/origin/i);
    expect(() => parseAllowedOrigins({ MEGAPLANETS_ALLOWED_ORIGINS: 'not an origin' })).toThrow(/origin/i);
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

  it('lists server-side Megastera proofs only for the requested recipient with bounded pagination', async () => {
    const store = new MemoryEligibilityStore();
    await store.saveProof({
      recipient: ticket.recipient,
      ticketId: ticket.ticketId,
      drawingId: ticket.drawingId,
      normals: ticket.normals,
      bonusBall: ticket.bonusBall,
      originTxHash: ticket.originTxHash,
      blockNumber: ticket.blockNumber,
      blockHash: `0x${'cd'.repeat(32)}`,
      logIndex: ticket.logIndex,
      purchasedAt: new Date('2026-08-11T00:00:00.000Z'),
      chainId: 84_532,
      jackpotAddress: '0x465dA3c859f193A3807386387bEE941B2A4c3279',
    });
    await store.saveProof({
      ...ticket,
      ticketId: 457n,
      recipient: '0x4444444444444444444444444444444444444444',
      blockHash: `0x${'de'.repeat(32)}`,
      logIndex: 5n,
      purchasedAt: new Date('2026-08-11T00:00:01.000Z'),
    });
    const app = createApp({ loadConfig: () => config, getStore: () => store });

    const response = await app.request(`/api/planets/megastera-proofs?recipient=${ticket.recipient}&offset=0&limit=1`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 1,
      offset: 0,
      limit: 1,
      proofs: [{ recipient: ticket.recipient, ticketId: '456', logIndex: '4' }],
    });
  });

  it('bounds Megastera proof lookup pagination', async () => {
    const response = await createApp().request('/api/planets/megastera-proofs?recipient=0x3333333333333333333333333333333333333333&limit=101');
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

  it('creates ordered batch vouchers for up to fifty references and preserves input order', async () => {
    const seen: number[] = [];
    const app = createApp({
      loadConfig: () => config,
      findTicket: async (_config, request) => {
        seen.push(request.logIndex);
        return { ...ticket, ticketId: BigInt(500 + request.logIndex), logIndex: BigInt(request.logIndex) };
      },
      prepare: async (_config, proof) => ({
        voucher: { ...voucher, ticketId: proof.ticketId, originTxHash: proof.originTxHash },
        signature: '0xdeadbeef', signer: '0x4444444444444444444444444444444444444444', digest: `0x${'cd'.repeat(32)}`,
      }),
      getStore: () => new MemoryEligibilityStore(),
    });
    const response = await app.request('/api/planets/vouchers/batch', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ proofs: [
        { transactionHash: ticket.originTxHash, logIndex: 4 },
        { transactionHash: ticket.originTxHash, logIndex: 7 },
      ] }),
    });
    expect(response.status).toBe(201);
    expect(seen).toEqual([4, 7]);
    expect(((await response.json()) as { vouchers: unknown[] }).vouchers).toHaveLength(2);
  });

  it('rejects an empty or oversized voucher batch', async () => {
    const app = createApp();
    expect((await app.request('/api/planets/vouchers/batch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proofs: [] }) })).status).toBe(400);
    expect((await app.request('/api/planets/vouchers/batch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ proofs: new Array(51).fill(requestBody) }) })).status).toBe(400);
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
