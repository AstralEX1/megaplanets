export const MAX_JSON_BODY_BYTES = 16 * 1024;

export async function readBoundedJson<T>(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<T | undefined> {
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new RangeError('Request body is too large.');
  if (!request.body) return undefined;
  const reader = request.clone().body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.byteLength;
    if (size > maxBytes) throw new RangeError('Request body is too large.');
    chunks.push(result.value);
  }
  const body = new TextDecoder().decode(concat(chunks, size));
  return JSON.parse(body) as T;
}

function concat(chunks: readonly Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out.`)), timeoutMs); });
  try { return await Promise.race([operation, timeout]); }
  finally { if (timer) clearTimeout(timer); }
}
