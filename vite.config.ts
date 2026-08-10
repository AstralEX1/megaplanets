import path from 'node:path';
import { Readable } from 'node:stream';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';

function planetVoucherDevApi(): Plugin {
  return {
    name: 'megaplanets-planet-voucher-api',
    enforce: 'pre',
    configResolved(config) {
      Object.assign(process.env, loadEnv(config.mode, config.root, ''));
    },
    configureServer(server) {
      const app = server.ssrLoadModule('/api/index.ts').then((module) => module.createApp());
      const mountApi = (prefix: string) => server.middlewares.use(prefix, async (request, response, next) => {
        try {
          const headers = new Headers();
          for (const [name, value] of Object.entries(request.headers)) {
            if (Array.isArray(value)) headers.set(name, value.join(', '));
            else if (value) headers.set(name, value);
          }
          const requestPath = request.url?.startsWith('/') ? request.url : `/${request.url ?? ''}`;
          const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : Readable.toWeb(request) as ReadableStream;
          const apiResponse = await (await app).fetch(new Request(`http://127.0.0.1:5173${prefix}${requestPath}`, { method: request.method, headers, body, duplex: 'half' }));
          response.statusCode = apiResponse.status;
          apiResponse.headers.forEach((value: string, name: string) => {
            response.setHeader(name, value);
          });
          response.end(Buffer.from(await apiResponse.arrayBuffer()));
        } catch (error) {
          next(error);
        }
      });
      mountApi('/api/auth');
      mountApi('/api/me');
      mountApi('/api/planets');
    },
  };
}

export default defineConfig({
  plugins: [react(), planetVoucherDevApi()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    exclude: ['**/node_modules/**', 'lib/**'],
  },
  // Dev-server proxy so `/api/megapot/*` forwards to api.megapot.io while you
  // work locally — no separate Hono process needed for development. In
  // production, mount `server/proxy.ts` on your backend of choice (see
  // `examples/`) or skip the proxy entirely (use the anonymous or browser-key
  // tiers documented in `.env.example`).
  server: {
    proxy: {
      '/api/megapot': {
        target: 'https://api.megapot.io',
        changeOrigin: true,
        rewrite: (incomingPath) => incomingPath.replace(/^\/api\/megapot/, '/v1'),
      },
    },
  },
});
