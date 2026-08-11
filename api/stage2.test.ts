import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { createStage2Routes } from './stage2';
import type { Stage2Config } from './stage2Config';
import { MemoryStage2Store } from './stage2Store';

const account = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const config: Stage2Config = {
  databaseUrl: 'postgresql://not-used-in-tests',
  rpcUrl: 'https://rpc.example.test',
  appOrigin: 'http://127.0.0.1:5173',
  sessionTtlSeconds: 3_600,
  chainId: 84_532,
};

function testApp(store: MemoryStage2Store) {
  const timestamp = new Date('2026-08-06T10:00:00.000Z');
  return createStage2Routes({
    loadConfig: () => config,
    getStore: () => store,
    now: () => timestamp,
    random: (length) => Buffer.alloc(length, length === 16 ? 1 : 2),
  });
}

describe('Stage 2 wallet authentication and Planet API', () => {
  it('consumes a wallet nonce once and resolves the HTTP-only session', async () => {
    const app = testApp(new MemoryStage2Store());
    const nonceResponse = await app.request('/auth/nonce', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: account.address }),
    });
    expect(nonceResponse.status).toBe(201);
    const challenge = (await nonceResponse.json()) as { message: string; nonce: string };
    const signature = await account.signMessage({ message: challenge.message });

    const verify = () =>
      app.request('/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: account.address, nonce: challenge.nonce, signature }),
      });
    const verified = await verify();
    expect(verified.status).toBe(200);
    expect((await verify()).status).toBe(401);

    const cookie = verified.headers.get('set-cookie');
    expect(cookie).toContain('HttpOnly');
    const me = await app.request('/me', { headers: { cookie: cookie?.split(';')[0] ?? '' } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ address: account.address });
  });

  it('returns indexed Planets by normalized owner and decimal token ID', async () => {
    const store = new MemoryStage2Store();
    store.seedPlanet({
      tokenId: '456',
      ticketId: '456',
      ownerAddress: account.address.toLowerCase() as `0x${string}`,
      kind: 'NORMAL',
      seasonId: `0x${'ee'.repeat(32)}`,
      seed: `0x${'aa'.repeat(32)}`,
      traitsHash: `0x${'bb'.repeat(32)}`,
      metadataHash: `0x${'cc'.repeat(32)}`,
      metadataUri: 'ipfs://planet-456',
      baseMineralsPerDay: '42',
      generatorVersion: 2,
      planetType: 'nebula',
      terrain: 'simplex',
      rarity: 'common',
      satelliteCount: 2,
      hasRing: false,
      mintTxHash: `0x${'dd'.repeat(32)}`,
      mintedAt: '2026-08-06T10:00:00.000Z',
      ticket: {
        drawingId: '12',
        normals: [1, 2, 3, 4, 5],
        bonusBall: 6,
        originTxHash: `0x${'ff'.repeat(32)}`,
      },
    });
    const app = testApp(store);

    const collection = await app.request(`/planets?owner=${account.address}`);
    expect(collection.status).toBe(200);
    expect(await collection.json()).toMatchObject({ planets: [{ tokenId: '456' }] });

    expect((await app.request('/planets/456')).status).toBe(200);
    expect((await app.request('/planets/not-a-token')).status).toBe(400);
  });

  it('returns a Planet mining snapshot as decimal strings', async () => {
    const store = new MemoryStage2Store();
    const app = createStage2Routes({
      loadConfig: () => config,
      getStore: () => store,
      now: () => new Date('2026-08-10T20:00:00.000Z'),
      getMining: async (_config, tokenId, now) => ({
        tokenId,
        ownerAddress: account.address.toLowerCase(),
        baseMineralsPerDay: '42000000',
        multiplierBps: '10500',
        pendingMicros: '123456',
        earnedMicros: '654321',
        activeSince: now.toISOString(),
      }),
    });

    const response = await app.request('/planets/456/mining');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mining: {
        tokenId: '456',
        ownerAddress: account.address.toLowerCase(),
        baseMineralsPerDay: '42000000',
        multiplierBps: '10500',
        pendingMicros: '123456',
        earnedMicros: '654321',
        activeSince: '2026-08-10T20:00:00.000Z',
      },
    });
  });

  it('returns the authenticated wallet mining aggregate', async () => {
    const timestamp = new Date('2026-08-10T20:00:00.000Z');
    const store = new MemoryStage2Store();
    const app = createStage2Routes({
      loadConfig: () => config,
      getStore: () => store,
      now: () => timestamp,
      random: (length) => Buffer.alloc(length, length === 16 ? 1 : 2),
      getWalletMining: async (_prisma, ownerAddress) => ({
        ownerAddress,
        asOf: timestamp.toISOString(),
        ownedPlanetCount: 2,
        pendingMicros: '3100000',
        earnedMicros: '10100000',
        effectiveMineralsPerDayMicros: '267840000000',
        planets: [],
      }),
    });
    const nonceResponse = await app.request('/auth/nonce', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: account.address }),
    });
    const challenge = (await nonceResponse.json()) as { message: string; nonce: string };
    const signature = await account.signMessage({ message: challenge.message });
    const verified = await app.request('/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address: account.address, nonce: challenge.nonce, signature }),
    });

    const response = await app.request('/me/mining', { headers: { cookie: verified.headers.get('set-cookie') ?? '' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mining: {
        ownerAddress: account.address.toLowerCase(),
        asOf: timestamp.toISOString(),
        ownedPlanetCount: 2,
        pendingMicros: '3100000',
        earnedMicros: '10100000',
        effectiveMineralsPerDayMicros: '267840000000',
        planets: [],
      },
    });
  });

  it('returns the public wallet mining aggregate for a valid address', async () => {
    const timestamp = new Date('2026-08-10T20:00:00.000Z');
    const store = new MemoryStage2Store();
    const app = createStage2Routes({
      loadConfig: () => config,
      getStore: () => store,
      now: () => timestamp,
      getWalletMining: async (_prisma, ownerAddress) => ({
        ownerAddress,
        asOf: timestamp.toISOString(),
        ownedPlanetCount: 1,
        pendingMicros: '1000000',
        earnedMicros: '5000000',
        effectiveMineralsPerDayMicros: '12000000',
        planets: [],
      }),
    });

    const response = await app.request(`/wallets/${account.address}/mining`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      mining: {
        ownerAddress: account.address.toLowerCase(),
        earnedMicros: '5000000',
        effectiveMineralsPerDayMicros: '12000000',
      },
    });
    expect((await app.request('/wallets/not-an-address/mining')).status).toBe(400);
  });
});
