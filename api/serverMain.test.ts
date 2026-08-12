import { Hono } from 'hono';
import type { IncomingMessage } from 'node:http';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createApiServer, nodeRequestToRequest, parseApiHost, parseApiPort } from './serverMain';

describe('standalone API server', () => {
  it('uses safe local defaults and validates the configured port', () => {
    expect(parseApiHost({})).toBe('127.0.0.1');
    expect(parseApiPort({})).toBe(8787);
    expect(parseApiPort({ MEGAPLANETS_API_PORT: '9000' })).toBe(9000);
    expect(() => parseApiPort({ MEGAPLANETS_API_PORT: '70000' })).toThrow('MEGAPLANETS_API_PORT');
  });

  it('forwards a Node request into a web Request without losing headers or body', async () => {
    const nodeRequest = new PassThrough() as PassThrough & {
      method?: string;
      url?: string;
      headers: Record<string, string>;
    };
    nodeRequest.method = 'POST';
    nodeRequest.url = '/v1';
    nodeRequest.headers = { host: '127.0.0.1:8787', 'content-type': 'application/json', 'x-test': 'yes' };
    const request = nodeRequestToRequest(nodeRequest as unknown as IncomingMessage, '127.0.0.1', 8787);
    nodeRequest.end(JSON.stringify({ ok: true }));

    expect(request.method).toBe('POST');
    expect(request.headers.get('x-test')).toBe('yes');
    expect(await request.json()).toEqual({ ok: true });
  });

  it('serves Hono responses through the Node adapter', async () => {
    const app = new Hono();
    app.get('/health', (c) => c.json({ ok: true }));
    const server = createApiServer(app, { host: '127.0.0.1', port: 0 });
    const requestHandler = server.listeners('request')[0] as (
      request: PassThrough & { method?: string; url?: string; headers: Record<string, string> },
      response: { statusCode: number; headersSent: boolean; setHeader: (name: string, value: string) => void; end: (body: Buffer) => void; destroy: () => void },
    ) => void;
    const nodeRequest = new PassThrough() as PassThrough & { method?: string; url?: string; headers: Record<string, string> };
    nodeRequest.method = 'GET';
    nodeRequest.url = '/health';
    nodeRequest.headers = { host: '127.0.0.1:8787' };
    const response = {
      statusCode: 0,
      headersSent: false,
      setHeader: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    };

    requestHandler(nodeRequest, response);
    await vi.waitFor(() => expect(response.end).toHaveBeenCalled());

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.end.mock.calls[0][0].toString())).toEqual({ ok: true });
  });
});
