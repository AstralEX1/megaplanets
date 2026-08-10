import { createHash, randomBytes } from 'node:crypto';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import { getAddress, isAddress, verifyMessage, type Address, type Hex } from 'viem';
import { z } from 'zod';
import type { Stage2Config } from './stage2Config';
import type { Stage2Store } from './stage2Store';

export const SESSION_COOKIE = 'megaplanets_session';
const NONCE_TTL_MS = 5 * 60 * 1_000;

const addressRequest = z.object({ address: z.string().refine(isAddress, 'Invalid wallet address.') });
const verifyRequest = addressRequest.extend({
  nonce: z.string().regex(/^[a-f0-9]{32}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const normalized = (address: string) => getAddress(address).toLowerCase() as Address;

export function createSignInMessage(args: {
  appOrigin: string;
  address: Address;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
  chainId: number;
}): string {
  const uri = new URL(args.appOrigin);
  return `${uri.host} wants you to sign in with your Ethereum account:\n${getAddress(args.address)}\n\nSign in to MegaPlanets.\n\nURI: ${uri.origin}\nVersion: 1\nChain ID: ${args.chainId}\nNonce: ${args.nonce}\nIssued At: ${args.issuedAt.toISOString()}\nExpiration Time: ${args.expiresAt.toISOString()}`;
}

function readSessionToken(request: { header: (name: string) => string | undefined }): string | undefined {
  const cookie = request.header('cookie');
  return cookie?.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
}

export async function resolveSession(store: Stage2Store, request: { header: (name: string) => string | undefined }, now: Date) {
  const token = readSessionToken(request);
  return token ? store.findSession(hash(token), now) : undefined;
}

export function createAuthRoutes(dependencies: {
  loadConfig: () => Stage2Config;
  getStore: (config: Stage2Config) => Stage2Store;
  now?: () => Date;
  random?: (bytes: number) => Buffer;
}) {
  const app = new Hono();
  const now = dependencies.now ?? (() => new Date());
  const random = dependencies.random ?? randomBytes;

  app.post('/nonce', async (c) => {
    const body = addressRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: 'A valid wallet address is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      const issuedAt = now();
      const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);
      const nonce = random(16).toString('hex');
      const walletAddress = normalized(body.data.address);
      const message = createSignInMessage({ appOrigin: config.appOrigin, address: walletAddress, nonce, issuedAt, expiresAt, chainId: config.chainId });
      await store.saveNonce({ nonceHash: hash(nonce), walletAddress, message, expiresAt });
      return c.json({ nonce, message, expiresAt: expiresAt.toISOString() }, 201);
    } catch {
      return c.json({ error: 'Wallet authentication is not configured.' }, 503);
    }
  });

  app.post('/verify', async (c) => {
    const body = verifyRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!body.success) return c.json({ error: 'Address, nonce, and signature are required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      const timestamp = now();
      const walletAddress = normalized(body.data.address);
      const nonceHash = hash(body.data.nonce);
      const challenge = await store.findNonce(nonceHash, walletAddress, timestamp);
      if (!challenge) return c.json({ error: 'The sign-in challenge is invalid or expired.' }, 401);
      const valid = await verifyMessage({ address: getAddress(walletAddress), message: challenge.message, signature: body.data.signature as Hex });
      if (!valid || !(await store.consumeNonce(nonceHash, walletAddress, timestamp))) {
        return c.json({ error: 'The wallet signature is invalid or already used.' }, 401);
      }
      const token = random(32).toString('hex');
      const expiresAt = new Date(timestamp.getTime() + config.sessionTtlSeconds * 1_000);
      await store.createSession({ tokenHash: hash(token), walletAddress, expiresAt });
      setCookie(c, SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: config.appOrigin.startsWith('https://'),
        path: '/',
        maxAge: config.sessionTtlSeconds,
      });
      return c.json({ address: getAddress(walletAddress), expiresAt: expiresAt.toISOString() });
    } catch {
      return c.json({ error: 'Wallet authentication failed.' }, 401);
    }
  });

  app.post('/logout', async (c) => {
    try {
      const config = dependencies.loadConfig();
      const store = dependencies.getStore(config);
      const token = getCookie(c, SESSION_COOKIE);
      if (token) await store.revokeSession(hash(token), now());
    } finally {
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
    }
    return c.body(null, 204);
  });

  return app;
}
