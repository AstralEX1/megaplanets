export type PinataUpload = { cid: string; uri: `ipfs://${string}` };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 1 * 1024 * 1024;
const CID_PATTERN = /^[A-Za-z0-9_-]{3,128}$/;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function uploadPublicFile(pinataJwt: string, name: string, file: Blob): Promise<PinataUpload> {
  if (!name || name.length > 160 || file.size > MAX_UPLOAD_BYTES) throw new RangeError('Pinata upload exceeds the configured bounds.');
  const form = new FormData();
  form.set('network', 'public');
  form.set('file', file, name);
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetchWithTimeout('https://uploads.pinata.cloud/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinataJwt}` },
      body: form,
    }, 20_000);
    if (response.ok || response.status === undefined || response.status < 500) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  if (!response?.ok) throw new Error(`Pinata upload failed (${response?.status ?? 0}).`);
  const bodyText = typeof response.text === 'function'
    ? await response.text()
    : JSON.stringify(await response.json());
  if (bodyText.length > 32_768) throw new Error('Pinata response exceeded the configured bound.');
  let body: unknown;
  try { body = JSON.parse(bodyText); } catch { throw new Error('Pinata returned malformed JSON.'); }
  const cid = body && typeof body === 'object' && 'data' in body && body.data && typeof body.data === 'object' && 'cid' in body.data && typeof body.data.cid === 'string'
    ? body.data.cid : undefined;
  if (!cid || !CID_PATTERN.test(cid)) throw new Error('Pinata response did not include a valid CID.');
  return { cid, uri: `ipfs://${cid}` };
}

/** Pin immutable JSON/media through Pinata's multipart v3 upload endpoint. */
export async function pinJson(pinataJwt: string, name: string, value: unknown): Promise<PinataUpload> {
  const json = JSON.stringify(value);
  if (json.length > MAX_JSON_BYTES) throw new RangeError('Pinata JSON payload exceeds the configured bound.');
  return uploadPublicFile(pinataJwt, name, new Blob([json], { type: 'application/json' }));
}

export async function pinGif(pinataJwt: string, name: string, bytes: Uint8Array): Promise<PinataUpload> {
  return uploadPublicFile(pinataJwt, name, new Blob([bytes], { type: 'image/gif' }));
}
