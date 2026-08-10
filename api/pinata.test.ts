import { afterEach, describe, expect, it, vi } from 'vitest';
import { pinGif, pinJson } from './pinata';

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  fetchMock.mockReset();
});

describe('Pinata uploads', () => {
  it('uploads JSON as a public multipart file', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { cid: 'metadata-cid' } }) });
    globalThis.fetch = fetchMock;

    await expect(pinJson('token', 'planet.json', { name: 'Planet' })).resolves.toEqual({ cid: 'metadata-cid', uri: 'ipfs://metadata-cid' });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request.headers).toEqual({ Authorization: 'Bearer token' });
    expect(request.body).toBeInstanceOf(FormData);
    const form = request.body as FormData;
    expect(form.get('network')).toBe('public');
    expect((form.get('file') as File).type).toBe('application/json');
  });

  it('uploads GIF content as a public multipart file', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { cid: 'image-cid' } }) });
    globalThis.fetch = fetchMock;

    await expect(pinGif('token', 'planet.gif', new Uint8Array([1, 2]))).resolves.toEqual({ cid: 'image-cid', uri: 'ipfs://image-cid' });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((request.body as FormData).get('network')).toBe('public');
    expect(((request.body as FormData).get('file') as File).type).toBe('image/gif');
  });
});
