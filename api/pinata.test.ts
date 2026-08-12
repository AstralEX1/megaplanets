import { afterEach, describe, expect, it, vi } from 'vitest';
import { pinGif, pinJson, pinWebM } from './pinata';

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

  it('uploads real WebM content with the video MIME and extension', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { cid: 'webm-cid' } }) });
    globalThis.fetch = fetchMock;

    await expect(pinWebM('token', 'planet.webm', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).resolves.toEqual({ cid: 'webm-cid', uri: 'ipfs://webm-cid' });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(((request.body as FormData).get('file') as File).type).toBe('video/webm');
  });

  it('rejects a malformed Pinata response schema', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { cid: 'x' } }) });
    globalThis.fetch = fetchMock;

    await expect(pinJson('token', 'planet.json', { name: 'Planet' })).rejects.toThrow(/valid CID/i);
  });
});
