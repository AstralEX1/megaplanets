import { Hono } from 'hono';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import { createAuthRoutes, resolveSession } from './auth';
import { getPrismaClient } from './database';
import { loadStage2Config, type Stage2Config } from './stage2Config';
import { PrismaStage2Store, type PlanetScope, type Stage2Store } from './stage2Store';
import { getPlanetMiningSnapshot, getWalletMiningSnapshot } from './miningStore';

export type Stage2Dependencies = {
  loadConfig: () => Stage2Config;
  getStore: (config: Stage2Config) => Stage2Store;
  getMining: typeof getPlanetMiningSnapshot;
  getWalletMining: typeof getWalletMiningSnapshot;
  now: () => Date;
  random?: (bytes: number) => Buffer;
};

const defaultDependencies: Stage2Dependencies = {
  loadConfig: () => loadStage2Config(process.env),
  getStore: (config) => new PrismaStage2Store(getPrismaClient(config.databaseUrl)),
  getMining: getPlanetMiningSnapshot,
  getWalletMining: getWalletMiningSnapshot,
  now: () => new Date(),
};

const tokenIdSchema = z.string().regex(/^\d{1,78}$/);

export function createStage2Routes(overrides: Partial<Stage2Dependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono();
  const scopeFor = (config: Stage2Config): PlanetScope | undefined =>
    config.planetContractAddress ? { chainId: config.chainId, contractAddress: config.planetContractAddress } : undefined;

  app.route(
    '/auth',
    createAuthRoutes({
      loadConfig: dependencies.loadConfig,
      getStore: dependencies.getStore,
      now: dependencies.now,
      random: dependencies.random,
    }),
  );

  app.get('/me', async (c) => {
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      const session = await resolveSession(store, c.req, dependencies.now());
      if (!session) return c.json({ error: 'Wallet authentication is required.' }, 401);
      return c.json({ address: getAddress(session.walletAddress), expiresAt: session.expiresAt.toISOString() });
    } catch {
      return c.json({ error: 'The Stage 2 API is not configured.' }, 503);
    }
  });

  app.get('/me/mining', async (c) => {
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      const session = await resolveSession(store, c.req, dependencies.now());
      if (!session) return c.json({ error: 'Wallet authentication is required.' }, 401);
      const mining = await dependencies.getWalletMining(
        getPrismaClient(config.databaseUrl),
        session.walletAddress,
        dependencies.now(),
        scopeFor(config),
      );
      return c.json({ mining });
    } catch {
      return c.json({ error: 'The mining API is not configured.' }, 503);
    }
  });

  app.get('/me/planets', async (c) => {
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      const session = await resolveSession(store, c.req, dependencies.now());
      if (!session) return c.json({ error: 'Wallet authentication is required.' }, 401);
      return c.json({ planets: await store.listPlanets(session.walletAddress, scopeFor(config)) });
    } catch {
      return c.json({ error: 'The Stage 2 API is not configured.' }, 503);
    }
  });

  app.get('/wallets/:address/mining', async (c) => {
    const address = c.req.param('address');
    if (!isAddress(address)) return c.json({ error: 'A valid wallet address is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const mining = await dependencies.getWalletMining(
        getPrismaClient(config.databaseUrl),
        getAddress(address).toLowerCase(),
        dependencies.now(),
        scopeFor(config),
      );
      return c.json({ mining });
    } catch {
      return c.json({ error: 'The mining API is not configured.' }, 503);
    }
  });

  app.get('/planets', async (c) => {
    const owner = c.req.query('owner');
    if (!owner || !isAddress(owner)) return c.json({ error: 'A valid owner address is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      return c.json({ planets: await store.listPlanets(getAddress(owner).toLowerCase() as `0x${string}`, scopeFor(config)) });
    } catch {
      return c.json({ error: 'The Stage 2 API is not configured.' }, 503);
    }
  });

  app.get('/planets/:tokenId/mining', async (c) => {
    const tokenId = tokenIdSchema.safeParse(c.req.param('tokenId'));
    if (!tokenId.success) return c.json({ error: 'A decimal token ID is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const mining = await dependencies.getMining(
        getPrismaClient(config.databaseUrl),
        tokenId.data,
        dependencies.now(),
        scopeFor(config),
      );
      return mining ? c.json({ mining }) : c.json({ error: 'Mining data is not available for this Planet.' }, 404);
    } catch {
      return c.json({ error: 'The mining API is not configured.' }, 503);
    }
  });

  app.get('/planets/:tokenId', async (c) => {
    const tokenId = tokenIdSchema.safeParse(c.req.param('tokenId'));
    if (!tokenId.success) return c.json({ error: 'A decimal token ID is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      const planet = await store.getPlanet(tokenId.data, scopeFor(config));
      return planet ? c.json({ planet }) : c.json({ error: 'Planet not found.' }, 404);
    } catch {
      return c.json({ error: 'The Stage 2 API is not configured.' }, 503);
    }
  });

  return app;
}
