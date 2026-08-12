import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import type { Hono } from 'hono';
import { createApp } from './index';

type FetchApp = Pick<Hono, 'fetch'>;

export function parseApiHost(env: Record<string, string | undefined>): string {
  const host = env.MEGAPLANETS_API_HOST?.trim();
  if (!host) return '127.0.0.1';
  if (host.includes('/') || host.includes(' ')) throw new Error('MEGAPLANETS_API_HOST must be a hostname or IP address.');
  return host;
}

export function parseApiPort(env: Record<string, string | undefined>): number {
  const raw = env.MEGAPLANETS_API_PORT?.trim();
  if (!raw) return 8_787;
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('MEGAPLANETS_API_PORT must be an integer between 1 and 65535.');
  }
  return port;
}

function copyHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(', '));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

export function nodeRequestToRequest(request: IncomingMessage, host: string, port: number): Request {
  const authority = request.headers.host ?? `${host}:${port}`;
  const url = new URL(request.url ?? '/', `http://${authority}`);
  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : Readable.toWeb(request) as ReadableStream;
  return new Request(url, {
    method,
    headers: copyHeaders(request),
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

export async function writeNodeResponse(response: Response, target: ServerResponse): Promise<void> {
  target.statusCode = response.status;
  response.headers.forEach((value, name) => {
    target.setHeader(name, value);
  });
  target.end(Buffer.from(await response.arrayBuffer()));
}

export function createApiServer(app: FetchApp, options: { host: string; port: number }) {
  return createServer(async (request, response) => {
    try {
      const webResponse = await app.fetch(nodeRequestToRequest(request, options.host, options.port));
      await writeNodeResponse(webResponse, response);
    } catch {
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ error: 'Internal server error.' }));
      } else {
        response.destroy();
      }
    }
  });
}

export async function startApiServer(env: Record<string, string | undefined> = process.env): Promise<ReturnType<typeof createApiServer>> {
  const host = parseApiHost(env);
  const port = parseApiPort(env);
  const server = createApiServer(createApp(), { host, port });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
  return server;
}

async function main() {
  const server = await startApiServer();
  const address = server.address();
  const host = parseApiHost(process.env);
  const port = typeof address === 'object' && address ? address.port : parseApiPort(process.env);
  process.stdout.write(`MegaPlanets API listening on http://${host}:${port}\n`);
  const shutdown = () => server.close(() => process.exit(0));
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
