import { describe, expect, it, vi } from 'vitest';
import config from './vite.config';

describe('planet voucher dev API', () => {
  it('keeps the query on an exact mounted endpoint without inserting a trailing slash', async () => {
    let forwardedUrl = '';
    const mountedHandlers = new Map<string, (request: object, response: object, next: () => void) => Promise<void>>();
    const server = {
      config: { mode: 'development' },
      ssrLoadModule: vi.fn().mockResolvedValue({
        createApp: () => ({
          fetch: async (request: Request) => {
            forwardedUrl = request.url;
            return new Response('{}', { status: 200 });
          },
        }),
      }),
      middlewares: {
        use: (prefix: string, handler: (request: object, response: object, next: () => void) => Promise<void>) => {
          mountedHandlers.set(prefix, handler);
        },
      },
    };
    const plugin = config.plugins?.flat().find((candidate) => candidate && candidate.name === 'megaplanets-planet-voucher-api');
    expect(plugin).toBeDefined();
    await plugin?.configureServer?.(server as never);

    const handler = mountedHandlers.get('/api/planets');
    expect(handler).toBeDefined();
    await handler?.(
      { method: 'GET', headers: {}, url: '/?owner=0x0000000000000000000000000000000000000001' },
      { statusCode: 0, setHeader: vi.fn(), end: vi.fn() },
      vi.fn(),
    );

    expect(forwardedUrl).toBe(
      'http://127.0.0.1:5173/api/planets?owner=0x0000000000000000000000000000000000000001',
    );
    expect(mountedHandlers.has('/api/wallets')).toBe(true);
    expect(mountedHandlers.has('/api/leaderboard')).toBe(true);
  });
});
